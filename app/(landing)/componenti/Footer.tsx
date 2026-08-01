import Link from "next/link"
import { LANDING_COPY } from "@/lib/landing/copy"

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-2xl font-bold mb-2">Turni</h3>
            <p className="text-gray-400 text-sm">
              Pianificazione intelligente dei turni di lavoro
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Link</h4>
            <ul className="space-y-2">
              {LANDING_COPY.footer.links.map((link, idx) => (
                <li key={idx}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Seguici</h4>
            <ul className="space-y-2">
              {LANDING_COPY.footer.social.map((social, idx) => (
                <li key={idx}>
                  <a
                    href={social.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
          <p>{LANDING_COPY.footer.copyright}</p>
        </div>
      </div>
    </footer>
  )
}
