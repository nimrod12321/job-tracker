type PeepssLogoProps = {
  className?: string
  decorative?: boolean
}

function PeepssLogo({ className = '', decorative = false }: PeepssLogoProps) {
  return (
    <img
      src="/assets/peepss-logo.svg"
      alt={decorative ? '' : 'Peepss'}
      aria-hidden={decorative || undefined}
      className={`peepss-logo peepss-logo-image ${className}`.trim()}
    />
  )
}

export default PeepssLogo
