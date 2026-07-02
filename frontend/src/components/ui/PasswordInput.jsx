import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function PasswordInput({
  className = "",
  inputClassName = "w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 outline-none focus:border-[#A98B75]",
  ...props
}) {
  const [show, setShow] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <input {...props} type={show ? "text" : "password"} className={inputClassName} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#A98B75] transition"
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
      </button>
    </div>
  );
}
