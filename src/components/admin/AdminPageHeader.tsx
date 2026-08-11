export function AdminPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-[13px] text-slate-500">{description}</p>}
    </div>
  );
}
