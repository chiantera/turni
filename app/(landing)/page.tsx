"use client"

import { useRef } from "react"
import HeroSection from "./componenti/HeroSection"
import VideoSection from "./componenti/VideoSection"
import ProblemSolution from "./componenti/ProblemSolution"
import FeaturesCards from "./componenti/FeaturesCards"
import Testimonials from "./componenti/Testimonials"
import FinalCTA from "./componenti/FinalCTA"
import FAQ from "./componenti/FAQ"
import Footer from "./componenti/Footer"

export default function LandingPage() {
  const videoRef = useRef<HTMLDivElement>(null)

  const handleDemoClick = () => {
    videoRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <main className="overflow-hidden">
      <HeroSection onDemoClick={handleDemoClick} />
      <div ref={videoRef}>
        <VideoSection />
      </div>
      <ProblemSolution />
      <FeaturesCards />
      <Testimonials />
      <FinalCTA />
      <FAQ />
      <Footer />
    </main>
  )
}
