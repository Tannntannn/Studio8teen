import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import { Link } from "react-router-dom";

import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

import hero1 from "../../assets/hero/hero1.jpg";
import hero2 from "../../assets/hero/hero2.jpg";
import hero3 from "../../assets/hero/hero3.jpg";
import hero4 from "../../assets/hero/hero4.jpg";
import hero5 from "../../assets/hero/hero5.jpg";

const images = [hero1, hero2, hero3, hero4, hero5];

function Hero() {
  return (
    <section id="home" className="relative min-h-[min(520px,85svh)] h-auto md:h-[90vh] scroll-mt-20 overflow-hidden bg-[#1a1410]">

      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
        }}
        speed={1500}
        loop={true}
        pagination={{ clickable: true }}
        className="hero-swiper w-full h-[min(420px,58svh)] md:absolute md:inset-0 md:h-full"
      >
        {images.map((image, index) => (
          <SwiperSlide key={index}>
            <div className="relative h-full w-full flex items-center justify-center bg-[#1a1410]">
              <img
                src={image}
                alt={`Slide ${index + 1}`}
                className="hero-slide-image w-full h-full object-contain md:object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-black/25 md:from-black/60 md:via-black/35 md:to-black/20 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Hero Content */}
      <div className="relative z-10 md:absolute md:inset-0 flex items-center py-10 md:py-0">
        <div className="max-w-7xl mx-auto px-6 w-full">

          <div className="max-w-2xl text-white">

            <span className="
              hero-animate inline-block px-5 py-2.5 rounded-full
              bg-white/10 backdrop-blur-md border border-white/20
              text-sm font-medium tracking-wider uppercase
            ">
              ✦ Studio 8Teen Photography
            </span>

            <h1 className="
              hero-animate-delay-1 heading-serif mt-4 md:mt-8
              text-3xl sm:text-5xl md:text-7xl
              font-bold leading-[1.1] tracking-tight
            ">
              Capture Life's
              <br />
              <span className="text-[#A98B75]">Most Meaningful</span>
              <br />
              Moments
            </h1>

            <p className="
              hero-animate-delay-2 mt-6 text-base sm:text-lg md:text-xl
              text-gray-200 max-w-lg leading-relaxed
            ">
              Professional studio photography,
              weddings, birthdays, photobooths,
              and event coverage—all in one place.
            </p>

            <div className="hero-animate-delay-3 mt-6 md:mt-10 flex flex-wrap gap-4">

              <Link
                to="/client-portfolio"
                className="
                  inline-block
                  px-8 py-3.5 rounded-full border-2 border-white/70 text-white
                  hover:bg-white hover:text-[#5B4636]
                  transition-all duration-300
                "
              >
                View Portfolio
              </Link>

            </div>

          </div>

        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="
        absolute bottom-8 left-1/2 -translate-x-1/2 z-10
        hidden md:flex flex-col items-center gap-2 text-white/50
      ">
        <span className="text-xs tracking-[0.2em] uppercase font-light">Scroll</span>
        <div
          className="w-[1px] h-8 bg-white/30"
          style={{ animation: "pulseSoft 2s ease-in-out infinite" }}
        />
      </div>

    </section>
  );
}

export default Hero;