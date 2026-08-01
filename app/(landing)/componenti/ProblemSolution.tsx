import { LANDING_COPY } from "@/lib/landing/copy"
import { COLORS } from "@/lib/landing/constants"

export default function ProblemSolution() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h3
              className="text-2xl md:text-3xl font-semibold mb-6"
              style={{ color: COLORS.textDark }}
            >
              {LANDING_COPY.problem.headline}
            </h3>
            <ul className="space-y-4">
              {LANDING_COPY.problem.bullets.map((bullet, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="text-red-500 font-bold text-xl flex-shrink-0 mt-0.5">
                    ❌
                  </span>
                  <span className="text-gray-700">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3
              className="text-2xl md:text-3xl font-semibold mb-6"
              style={{ color: COLORS.success }}
            >
              {LANDING_COPY.solution.headline}
            </h3>
            <ul className="space-y-4">
              {LANDING_COPY.solution.bullets.map((bullet, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="text-green-500 font-bold text-xl flex-shrink-0 mt-0.5">
                    ✅
                  </span>
                  <span className="text-gray-700">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
