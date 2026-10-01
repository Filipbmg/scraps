export function SnowdropMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="19" fill="currentColor" />
      <path d="M27 48V27c0-15 22-17 22-2" stroke="#bdd2a7" strokeWidth="3" strokeLinecap="round" />
      <path d="M27 44C15 42 13 33 13 33c12 0 17 7 14 11Z" fill="#bdd2a7" />
      <path d="M49 23c-7 1-12 7-12 15 4 0 6-2 8-4 1 4 3 6 6 7 3-5 5-9 3-13Z" fill="#f6f8e9" />
    </svg>
  )
}
