import { HeroSection } from "@/components/marketing/hero-section";
import { StatsStrip } from "@/components/marketing/stats-strip";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ReviewerTrinity } from "@/components/marketing/reviewer-trinity";
import { CtaFooter } from "@/components/marketing/cta-footer";

export default function LandingPage() {
  return (
    <div className="-mx-4 -mt-24 flex flex-col bg-black">
      <HeroSection />
      <StatsStrip />
      <HowItWorks />
      <ReviewerTrinity />
      <CtaFooter />
    </div>
  );
}
