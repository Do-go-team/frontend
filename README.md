# DoGo Frontend

AI 기반 VMD(Visual Merchandising Design) 서비스를 위한 프론트엔드 프로젝트입니다.
매장 도면을 기반으로 2D/3D 레이아웃을 편집하고, 상품 탐지 및 3D 자산 생성 흐름을 연동하는 웹 애플리케이션입니다.

## Migration Note

이 코드베이스는 기존 GitLab 저장소의 프론트엔드 소스 코드를 새로운 GitHub 기반 코드베이스로 이관한 프로젝트입니다.

## Local Development

```bash
corepack pnpm install
corepack pnpm dev
```

검사 및 빌드:

```bash
corepack pnpm lint
corepack pnpm build
```

## Environment Variables

로컬 개발에서는 `.env.example`을 참고해 `.env.local`을 생성합니다.

```env
VITE_API_BASE_URL=/api/v1
VITE_API_PROXY_TARGET=https://do-goproject.com
VITE_USE_MOCK=true
```

- `VITE_API_BASE_URL`: 브라우저에서 호출할 API base URL입니다.
- `VITE_API_PROXY_TARGET`: 로컬 개발 서버에서 `/api`, `/media` 요청을 프록시할 대상입니다.
- `VITE_USE_MOCK`: `true`이면 mock adapter를 사용하고, `false`이면 REST API를 호출합니다.

