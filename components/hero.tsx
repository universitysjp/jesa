"use client";

import Image from "next/image";
import type React from "react";
import Particles from "@/components/core/particles";
import { Spotlight } from "@/components/core/spotlight";
import { CtaButton } from "@/components/ui/cta-button";

const Hero: React.FC = () => {
	return (
		<section className="hero relative px-safe pt-[124px] pb-[120px] md:pt-[142px] md:pb-[136px] lg:pt-[232px] lg:pb-[160px] xl:pt-[180px] xl:pb-[162px]">
			<Spotlight />

			{/* Space for image above the title */}
			<div className="absolute inset-x-0 top-20 h-[200px] md:h-[250px] lg:h-[300px] xl:h-[320px]">
				<div className="relative flex h-full w-full items-center justify-center pt-0 md:pt-10 lg:pt-20 xl:pt-24">
					<Image
						alt="JESA"
						className="h-[200px] w-[100px] object-contain md:h-[250px] md:w-[150px] lg:h-[300px] lg:w-[200px] xl:h-[320px] xl:w-[250px]"
						height={300}
						priority
						src="/images/statue.png"
						width={200}
					/>
				</div>

				<Particles
					className="absolute inset-0"
					color={"#fcd34d"}
					staticity={100}
					ease={80}
					quantity={100}
					refresh
				/>
			</div>

			<div className="container mx-auto flex flex-col items-center justify-center lg:max-w-5xl">
				<h1 className="relative z-20 mt-[120px] max-w-[340px] bg-[linear-gradient(92deg,rgba(255,255,255,0.60)_6.46%,#FFF_22.73%,rgba(255,255,255,1.00)_79.27%,rgba(255,255,255,0.50)_95.93%)] bg-clip-text pb-2 text-center font-title text-[40px] text-transparent leading-[1.125] tracking-tight md:mt-[140px] md:max-w-none md:text-[56px] lg:mt-[160px] lg:text-[64px] xl:mt-[180px] xl:text-[72px]">
					{" "}
					<span className="block bg-[linear-gradient(180deg,rgba(251,191,36,1)_0%,rgba(251,191,36,0)_70%)] bg-clip-text text-white md:inline md:text-transparent">
						J'pura Employability <br className="hidden md:block" /> Skills
						Awards
					</span>
				</h1>

				<p className="mt-5 max-w-[312px] text-center text-slate-300 tracking-tight md:max-w-[532px] md:text-lg lg:mt-6 lg:text-xl">
					Bask in the spotlight of recognition at the most prestigious and
					elegant
					<br className="block md:hidden" /> award gala ever organized by the
					University of Sri Jayewardenepura.
				</p>

				<div className="mt-8 flex w-full max-w-md flex-col items-center justify-center gap-4 sm:flex-row">
					<div className="w-full sm:w-1/2">
						<CtaButton href="/portfolio-submission" shimmer>
							Submit Portfolio
						</CtaButton>
					</div>

					<div className="w-full sm:w-1/2">
						<CtaButton href="/hall-of-fame" variant="secondary">
							Hall of Fame{" "}
						</CtaButton>
					</div>
				</div>
				{/* <CountdownTimer /> */}
			</div>

			<div
				aria-hidden="true"
				className="-z-30 absolute inset-x-0 bottom-0 h-[490px] md:h-[629px] lg:h-[641px] xl:h-[689px]"
			>
				<div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-amber-100/20 opacity-30" />
				<div className="absolute inset-0 z-10 bg-[radial-gradient(closest-side,rgba(251,191,36,0.12),transparent)]" />
			</div>
		</section>
	);
};

export default Hero;
