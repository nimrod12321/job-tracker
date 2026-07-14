type PeepssLogoProps = {
  className?: string
}

function PeepssLogo({ className }: PeepssLogoProps) {
  const classes = ['peepss-logo', className].filter(Boolean).join(' ')

  return <img src="/assets/peepss-logo.png" alt="Peepss" className={classes} />
}

export default PeepssLogo
