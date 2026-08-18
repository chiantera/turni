interface WelcomeHeaderProps {
  userName: string
}

export default function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold sm:text-3xl">
        Bentornato, {userName}
      </h1>
      <p className="mt-1 text-tenue">
        Turni distribuisce n lavoratori su m postazioni rispettando contratti,
        riposi e assenze.
      </p>
    </div>
  )
}
