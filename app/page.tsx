import { HeroSection } from "@/components/marketing/hero-section";
import { LiveTradeCard } from "@/components/marketing/live-trade-card";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ReviewerTrinity } from "@/components/marketing/reviewer-trinity";
import { PanelDebate } from "@/components/marketing/panel-debate";
import { Faq } from "@/components/marketing/faq";
import { CtaFooter } from "@/components/marketing/cta-footer";

export default function LandingPage() {
  return (
    <div className="-mx-4 -mt-24 flex flex-col bg-black">
      <HeroSection />
      <LiveTradeCard />
      <HowItWorks />
      <ReviewerTrinity />
      <PanelDebate />
      <Faq />
      <CtaFooter />
    </div>
  );
}
