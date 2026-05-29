# =============================================================================
#  VMD Frontend Dockerfile
#  React 19 + Vite 8 + TypeScript + TailwindCSS 4 + TanStack Router/Query
#
#  설계 근거: infra/.ai/plan/fe_ci_pnpm_migration_plan.md §2.2
#             (FE 가 채택한 pnpm + Biome 스택에 맞춘 정합화)
#
#  의도:
#    - 본 컨테이너는 런타임 웹 서버를 띄우지 않는다.
#    - 빌드 산출물(/dist/*)을 named volume `frontend_dist` 에 export 후 종료.
#    - 사용자 트래픽은 nginx-edge 가 같은 볼륨을 read-only mount 하여 직접 서빙.
#    - 즉, 컨테이너 수명은 "빌드 → 복사 → exit 0" 일회성 (compose --profile frontend run --rm)
#
#  Stage 2 베이스로 `scratch` 가 아닌 `alpine` 을 선택한 이유:
#    - 볼륨 mount 시점에 dist 파일을 매번 갱신하려면 `cp` / `rm` 같은 셸 유틸이
#      필요하다. scratch 에는 셸이 없어 ENTRYPOINT 실행이 불가능.
#    - alpine:3.19 는 ~7MB 로 충분히 가볍다.
#
#  pnpm + corepack 패턴:
#    - node:20-alpine 에 corepack 가 사전 설치되어 있음 (활성화만 필요).
#    - `corepack enable` 로 packageManager 필드(pnpm@10.30.3...) 를 그대로 사용.
#    - BuildKit cache 마운트로 pnpm store 재활용 → 반복 빌드 시간 ↓
#
#  TanStack Router 의 routeTree.gen.ts 는 `pnpm build` 시 vite plugin 이
#  자동 생성하므로 별도 사전 처리 불필요.
# =============================================================================
# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1 — build (Node.js + pnpm)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# corepack 으로 packageManager 필드(pnpm@X.Y.Z) 를 정확히 재현.
# 별도 prepare/activate 없이도 첫 pnpm 호출 시 자동 다운로드/활성화됨.
RUN corepack enable

# ─── 빌드 시점 환경변수 ───────────────────────────────────────────────────
# Vite 가 정적 자산에 inline 하므로 런타임 변경 불가. 환경별 별도 빌드 필요.

# 필수: BE API 주소
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 옵션: 현재 FE 미사용. 향후 도입 시 compose --build-arg 로 채우면 즉시 동작.
# 빈 값으로 빌드해도 Vite 통과 (process.env 조건 분기 권장).
ARG VITE_WS_BASE_URL=""
ARG VITE_CDN_BASE_URL=""
ARG VITE_SENTRY_DSN=""
ARG VITE_GTM_ID=""
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL} \
    VITE_CDN_BASE_URL=${VITE_CDN_BASE_URL} \
    VITE_SENTRY_DSN=${VITE_SENTRY_DSN} \
    VITE_GTM_ID=${VITE_GTM_ID} \
    NODE_ENV=production \
    CI=true

# ─── 의존성 설치 ──────────────────────────────────────────────────────────
# 1) 의존성 매니페스트(package.json + pnpm-lock.yaml)만 먼저 복사 → 레이어 캐시
# 2) BuildKit cache 마운트로 pnpm store(~/.local/share/pnpm/store) 재활용
# 3) --frozen-lockfile: lock 파일과 package.json 미일치 시 즉시 fail (재현성)
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ─── 소스 복사 + 빌드 ─────────────────────────────────────────────────────
# `pnpm build` = "tsc -b && vite build"
#   - tsc -b: tsconfig.app.json + tsconfig.node.json 양쪽 검사 (strict)
#   - vite build: routeTree.gen.ts 자동 생성 + 정적 산출물 → /app/dist
COPY . .
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 2 — export (one-shot, runtime 웹 서버 X)
# -----------------------------------------------------------------------------
FROM alpine:3.19 AS export

# coreutils: cp -a 의 GNU 확장 옵션 (preserve-all) 사용을 위해
RUN apk add --no-cache coreutils

# 빌드 산출물을 이미지에 박아둠 (read-only source)
COPY --from=build /app/dist /dist-source

# /dist 는 compose volume(frontend_dist)으로 마운트되는 지점
# 컨테이너 기동 시:
#   1) 이전 배포 잔존 파일 제거 (rm -rf /dist/*)
#   2) 새 산출물 복사 (cp -a)
#   3) 정상 종료 (exit 0)
ENTRYPOINT ["sh", "-c", "set -e; \
  echo '[vmd-frontend] cleaning /dist'; \
  rm -rf /dist/* /dist/.[!.]* 2>/dev/null || true; \
  echo '[vmd-frontend] copying build artifacts to /dist'; \
  cp -a /dist-source/. /dist/; \
  echo '[vmd-frontend] export complete ($(find /dist -type f | wc -l) files)'; \
  exit 0"]
