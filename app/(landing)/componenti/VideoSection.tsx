"use client"

import { LANDING_COPY } from "@/lib/landing/copy"
import { useRef, useState } from "react"

export default function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold text-center mb-4">
          {LANDING_COPY.video.headline}
        </h2>

        <div className="relative w-full max-w-2xl mx-auto mb-6 bg-gray-900 rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/landing-demo.mp4" type="video/mp4" />
            <img
              src="/landing-demo-fallback.png"
              alt="Demo di Turni"
              className="w-full h-full object-cover"
            />
          </video>

          <button
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) {
                  videoRef.current.play()
                  setIsPlaying(true)
                } else {
                  videoRef.current.pause()
                  setIsPlaying(false)
                }
              }
            }}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity"
            aria-label={isPlaying ? "Pausa video" : "Riproduci video"}
          >
            {!isPlaying && (
              <svg
                className="w-16 h-16 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-center text-lg text-gray-600">
          {LANDING_COPY.video.subheader}
        </p>
      </div>
    </section>
  )
}
