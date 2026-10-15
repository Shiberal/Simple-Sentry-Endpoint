/**
 * Product mark: radar-style motif (monitoring), inherits currentColor.
 */
export default function BrandMark({ className, size = 28, title }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.22"
      />
      <path
        d="M16 16V5a11 11 0 0 1 9.53 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.75" fill="currentColor" />
    </svg>
  );
}
