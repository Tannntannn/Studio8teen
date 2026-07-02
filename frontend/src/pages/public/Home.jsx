import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import Hero from "../../components/home/Hero";
import Services from "../../components/home/Services";
import Portfolio from "../../components/home/Portfolio";
import Packages from "../../components/home/Packages";
import Contact from "../../components/home/Contact";

function Home() {
  return (
    <>
      <Navbar />
      <div className="h-20" />
      <Hero />
      <Services />
      <Portfolio />
      <Packages />
      <Contact />
      <Footer />
    </>
  );
}

export default Home;
