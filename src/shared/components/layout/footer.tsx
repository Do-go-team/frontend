export function Footer() {
	return (
		<footer className="bg-primary py-8">
			<div className="mx-auto flex max-w-screen-xl flex-col items-center gap-3 px-6">
				<a
					href="/support"
					className="text-xs text-white/60 transition-colors hover:text-white"
				>
					고객센터
				</a>
				<p className="text-xs text-white/60">
					Copyright 2026 Do-go team All rights reserved
				</p>
			</div>
		</footer>
	);
}
