import { cn } from "@/shared/lib/utils";

/* ─── Heading ────────────────────────────────── */

export function H1({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h1
			className={cn(
				"scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
				className,
			)}
			{...props}
		>
			{children}
		</h1>
	);
}

export function H2({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h2
			className={cn(
				"scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
				className,
			)}
			{...props}
		>
			{children}
		</h2>
	);
}

export function H3({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3
			className={cn(
				"scroll-m-20 text-2xl font-semibold tracking-tight",
				className,
			)}
			{...props}
		>
			{children}
		</h3>
	);
}

export function H4({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h4
			className={cn(
				"scroll-m-20 text-xl font-semibold tracking-tight",
				className,
			)}
			{...props}
		>
			{children}
		</h4>
	);
}

/* ─── Body ───────────────────────────────────── */

export function P({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
			{...props}
		>
			{children}
		</p>
	);
}

export function Lead({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p className={cn("text-xl text-muted-foreground", className)} {...props}>
			{children}
		</p>
	);
}

export function Large({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("text-lg font-semibold", className)} {...props}>
			{children}
		</div>
	);
}

export function Small({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLElement>) {
	return (
		<small
			className={cn("text-sm font-medium leading-none", className)}
			{...props}
		>
			{children}
		</small>
	);
}

export function Subtle({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p className={cn("text-sm text-muted-foreground", className)} {...props}>
			{children}
		</p>
	);
}

/* ─── Inline ─────────────────────────────────── */

export function InlineCode({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLElement>) {
	return (
		<code
			className={cn(
				"relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
				className,
			)}
			{...props}
		>
			{children}
		</code>
	);
}

/* ─── Block ──────────────────────────────────── */

export function Blockquote({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLElement>) {
	return (
		<blockquote
			className={cn("mt-6 border-l-2 border-primary pl-6 italic", className)}
			{...props}
		>
			{children}
		</blockquote>
	);
}

export function UL({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLUListElement>) {
	return (
		<ul className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)} {...props}>
			{children}
		</ul>
	);
}

export function TableWrapper({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("my-6 w-full overflow-y-auto", className)} {...props}>
			<table className="w-full">{children}</table>
		</div>
	);
}

export function THead({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
	return (
		<thead className={cn("[&_tr]:border-b", className)} {...props}>
			{children}
		</thead>
	);
}

export function TRow({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
	return (
		<tr className={cn("m-0 border-t p-0 even:bg-muted", className)} {...props}>
			{children}
		</tr>
	);
}

export function TH({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLTableCellElement>) {
	return (
		<th
			className={cn(
				"border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right",
				className,
			)}
			{...props}
		>
			{children}
		</th>
	);
}

export function TD({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLTableCellElement>) {
	return (
		<td
			className={cn(
				"border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right",
				className,
			)}
			{...props}
		>
			{children}
		</td>
	);
}
