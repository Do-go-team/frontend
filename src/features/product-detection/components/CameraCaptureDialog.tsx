import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";

interface CameraCaptureDialogProps {
	open: boolean;
	isUploading: boolean;
	onClose: () => void;
	onUpload: (file: File) => Promise<boolean>;
}

function createCaptureFileName() {
	return `capture-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
}

async function getRearCameraStream() {
	if (!window.isSecureContext) {
		throw new Error(
			"카메라 촬영은 localhost 또는 HTTPS 환경에서만 사용할 수 있습니다.",
		);
	}
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new Error("이 브라우저는 카메라 촬영을 지원하지 않습니다.");
	}
	return navigator.mediaDevices.getUserMedia({
		audio: false,
		video: {
			facingMode: { ideal: "environment" },
		},
	});
}

function stopStream(stream: MediaStream | null) {
	for (const track of stream?.getTracks() ?? []) {
		track.stop();
	}
}

export function CameraCaptureDialog({
	open,
	isUploading,
	onClose,
	onUpload,
}: CameraCaptureDialogProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const previewUrlRef = useRef<string | null>(null);
	const [isCameraStarting, setIsCameraStarting] = useState(false);
	const [capturedFile, setCapturedFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const revokePreviewUrl = useCallback(() => {
		if (previewUrlRef.current) {
			URL.revokeObjectURL(previewUrlRef.current);
			previewUrlRef.current = null;
		}
	}, []);

	const clearPreview = useCallback(() => {
		revokePreviewUrl();
		setPreviewUrl(null);
		setCapturedFile(null);
	}, [revokePreviewUrl]);

	const stopCamera = useCallback(() => {
		stopStream(streamRef.current);
		streamRef.current = null;
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
	}, []);

	const startCamera = useCallback(async () => {
		clearPreview();
		setIsCameraStarting(true);
		setErrorMessage(null);
		try {
			stopCamera();
			const stream = await getRearCameraStream();
			streamRef.current = stream;
			const video = videoRef.current;
			if (video) {
				video.srcObject = stream;
				await video.play();
			}
		} catch (error) {
			stopCamera();
			setErrorMessage(
				error instanceof Error
					? error.message
					: "카메라를 시작하지 못했습니다.",
			);
		} finally {
			setIsCameraStarting(false);
		}
	}, [clearPreview, stopCamera]);

	useEffect(() => {
		if (!open) {
			stopCamera();
			revokePreviewUrl();
			return;
		}
		const startTimer = window.setTimeout(() => {
			void startCamera();
		}, 0);
		return () => {
			window.clearTimeout(startTimer);
			stopCamera();
		};
	}, [open, revokePreviewUrl, startCamera, stopCamera]);

	useEffect(() => {
		return () => {
			stopCamera();
			revokePreviewUrl();
		};
	}, [revokePreviewUrl, stopCamera]);

	const capturePhoto = useCallback(async () => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!video || !canvas) return;
		const width = video.videoWidth;
		const height = video.videoHeight;
		if (width <= 0 || height <= 0) {
			setErrorMessage(
				"카메라 화면을 아직 읽을 수 없습니다. 잠시 후 다시 촬영해주세요.",
			);
			return;
		}

		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) {
			setErrorMessage("사진 캡처를 준비하지 못했습니다.");
			return;
		}
		context.drawImage(video, 0, 0, width, height);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob(resolve, "image/jpeg", 0.92);
		});
		if (!blob) {
			setErrorMessage("사진 파일을 생성하지 못했습니다.");
			return;
		}

		const file = new File([blob], createCaptureFileName(), {
			type: "image/jpeg",
		});
		const objectUrl = URL.createObjectURL(file);
		clearPreview();
		previewUrlRef.current = objectUrl;
		setCapturedFile(file);
		setPreviewUrl(objectUrl);
		setErrorMessage(null);
		stopCamera();
	}, [clearPreview, stopCamera]);

	const retakePhoto = useCallback(() => {
		clearPreview();
		void startCamera();
	}, [clearPreview, startCamera]);

	const uploadCapturedPhoto = useCallback(async () => {
		if (!capturedFile) return;
		setErrorMessage(null);
		const ok = await onUpload(capturedFile);
		if (ok) {
			onClose();
			return;
		}
		setErrorMessage(
			"업로드에 실패했습니다. 같은 사진으로 다시 시도할 수 있습니다.",
		);
	}, [capturedFile, onClose, onUpload]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
			<div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
				<div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
					<div>
						<h3 className="text-sm font-semibold text-text">
							상품 탐지 사진 촬영
						</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							후면 카메라로 촬영한 뒤 확인 후 업로드합니다.
						</p>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onClose}
						disabled={isUploading}
					>
						닫기
					</Button>
				</div>

				<div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
					<div className="overflow-hidden rounded-xl border border-border bg-slate-950">
						{previewUrl ? (
							<img
								src={previewUrl}
								alt="촬영한 상품 탐지 사진"
								className="h-[52vh] max-h-[520px] min-h-[260px] w-full object-contain"
							/>
						) : (
							<video
								ref={videoRef}
								autoPlay
								muted
								playsInline
								className="h-[52vh] max-h-[520px] min-h-[260px] w-full object-contain"
							/>
						)}
					</div>
					<canvas ref={canvasRef} className="hidden" />

					{errorMessage && (
						<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
							{errorMessage}
						</div>
					)}

					{isCameraStarting && !previewUrl && (
						<p className="text-center text-xs text-muted-foreground">
							카메라를 준비하는 중입니다...
						</p>
					)}
				</div>

				<div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
					{previewUrl ? (
						<>
							<Button
								type="button"
								variant="outline"
								onClick={retakePhoto}
								disabled={isUploading}
							>
								다시 촬영
							</Button>
							<Button
								type="button"
								onClick={uploadCapturedPhoto}
								disabled={isUploading || !capturedFile}
							>
								{isUploading
									? "업로드 중..."
									: errorMessage
										? "재시도"
										: "업로드"}
							</Button>
						</>
					) : (
						<Button
							type="button"
							onClick={capturePhoto}
							disabled={
								isCameraStarting || isUploading || Boolean(errorMessage)
							}
						>
							촬영
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
