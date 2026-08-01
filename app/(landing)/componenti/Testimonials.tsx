import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function Testimonials() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-12">
          Chi lo dice
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {LANDING_COPY.testimonials.map((testimonial, idx) => (
            <div
              key={idx}
              className="p-8 rounded-lg bg-white border border-gray-200"
            >
              <div className="mb-4 flex gap-1">
                {[...Array(testimonial.stars)].map((_, i) => (
                  <span key={i} className="text-yellow-400">
                    ⭐
                  </span>
                ))}
              </div>

              <p className="text-lg text-gray-700 mb-6 italic leading-relaxed">
                «{testimonial.quote}»
              </p>

              <div>
                <p
                  className="font-semibold"
                  style={{ color: COLORS.textDark }}
                >
                  — {testimonial.author}
                </p>
                <p className="text-sm text-gray-500">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
