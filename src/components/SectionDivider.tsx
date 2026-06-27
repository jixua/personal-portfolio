export function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-3.5 py-5">
      <div className="h-px w-36 bg-gradient-to-r from-transparent to-gray-200" />
      <div className="flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-[1px] rotate-45" style={{ background: 'var(--seal)', opacity: 0.3 }} />
        <div className="w-[7px] h-[7px] rounded-[1px] rotate-45" style={{ background: 'var(--seal)', opacity: 0.6 }} />
        <div className="w-1 h-1 rounded-[1px] rotate-45" style={{ background: 'var(--seal)', opacity: 0.3 }} />
      </div>
      <div className="h-px w-36 bg-gradient-to-l from-transparent to-gray-200" />
    </div>
  );
}
