export function AdminPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-[26px] font-semibold tracking-tight text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-[15px] text-slate-500">{description}</p>}
    </div>
  );
}
