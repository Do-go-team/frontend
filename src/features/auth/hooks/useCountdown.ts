// 인증번호 만료 시간 카운트다운 훅

import { useCallback, useEffect, useRef, useState } from "react";

export function useCountdown() {
	const [timeLeft, setTimeLeft] = useState(0);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const clear = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const start = useCallback(
		(seconds: number) => {
			clear();
			setTimeLeft(seconds);
			const id = setInterval(() => {
				setTimeLeft((prev) => {
					if (prev <= 1) {
						clearInterval(id);
						timerRef.current = null;
						return 0;
					}
					return prev - 1;
				});
			}, 1000);
			timerRef.current = id;
		},
		[clear],
	);

	useEffect(() => {
		return () => clear();
	}, [clear]);

	return { timeLeft, start, clear };
}
