import { Link } from "react-router-dom";
import logo from "../../assets/StudioLogo.jpg";

function PortfolioNavbar() {
    return (
        <nav className="bg-white border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto px-6">

                <div className="h-20 flex items-center justify-between">

                    <Link to="/">
                        <img
                            src={logo}
                            alt="Studio 8Teen"
                            className="h-12 object-contain"
                        />
                    </Link>

                    <div className="flex items-center gap-4">

                        <Link
                            to="/"
                            className="
                text-gray-600
                hover:text-[#A98B75]
                transition
              "
                        >
                            Home
                        </Link>

                        <Link
                            to="/login"
                            className="
                px-5 py-2
                rounded-full
                bg-[#A98B75]
                text-white
                hover:bg-[#8a7260]
                transition
              "
                        >
                            Login
                        </Link>

                    </div>

                </div>

            </div>
        </nav>
    );
}

export default PortfolioNavbar;