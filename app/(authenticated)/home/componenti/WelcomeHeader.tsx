interface WelcomeHeaderProps {
  userName: string
}

export default function WelcomeHeader({ userName }: WelcomeHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Bentornato, {userName}! 👋
      </h1>
      <p className="text-gray-600 mt-2">
        Gestisci i tuoi turni e visualizza i progressi
      </p>
    </div>
  )
}
