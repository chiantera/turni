import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function FeaturesCards() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
          {LANDING_COPY.features.headline}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {LANDING_COPY.features.items.map((feature, idx) => (
            <div
              key={idx}
              className="p-8 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
              style={{ backgroundColor: COLORS.bgAlt }}
            >
              <div className="text-5xl mb-4">{feature.icon}</div>

              <h3
                className="text-xl font-semibold mb-3"
                style={{ color: COLORS.textDark }}
              >
                {feature.title}
              </h3>

              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
