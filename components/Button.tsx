import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'cyan' | 'yellow' | 'black';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-bold border-3 border-black transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-hard-hover disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider";
  
  const sizeStyles = {
    sm: "px-3 py-1 text-sm shadow-hard-sm",
    md: "px-6 py-2 text-base shadow-hard",
    lg: "px-8 py-3 text-lg shadow-hard"
  };

  const variants = {
    primary: "bg-brand-pink text-white hover:bg-pink-600",
    secondary: "bg-white text-black hover:bg-gray-100",
    cyan: "bg-brand-cyan text-black hover:bg-cyan-400",
    yellow: "bg-brand-yellow text-black hover:bg-yellow-400",
    black: "bg-black text-white hover:bg-gray-900", // Matches the "Číst víc" button
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};