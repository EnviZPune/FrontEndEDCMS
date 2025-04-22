import React from 'react';
import Navbar from '../Components/Navbar';
import '../Styling/about.css';

const About = () => {
  return (
    <>
      <Navbar />
      <div className="about-container">
        {/* Logo */}
        <img src="Assets/logo.png" id="logo_ed" alt="E & D Logo" className='about-logo'/>
        <p className="about-slogan">Search smart. Shop faster. Powered by real-time stores.</p>
        <h1>About Us</h1>
        <p>
          <strong>Welcome to E & D – Albania's First Online Shopping Mall.</strong>
        </p>
        <p>
          At E & D, we're not just another e-commerce site. We're something completely different — 
          a <strong>real-time digital directory</strong> of physical clothing stores from all around the country. 
          Our goal? To show you <strong>what’s in stock, right now</strong>, without you having to leave your home.
        </p>
        <p>
          Whether you're on your laptop or just lying in bed with your phone, E & D lets you search for 
          any clothing item you're looking for. Our system scans all registered shops across Albania 
          and shows you <strong>exactly which stores have that product available today. </strong> 
          No more calling around. No more walking shop to shop. Just search, and you’ll know where to go.
        </p>
        <p>
          We connect real shops with real people. Every business that joins E & D manages their own 
          shop profile and uploads their current inventory — not just generic catalog items, but 
          <strong> what’s physically available in-store today.</strong>
        </p>
        <p>
          Each shop is verified, and their owners and employees help maintain updated listings to make 
          your shopping experience smooth, secure, and simple.
        </p>
        <p>
          If someone around the country has what you're looking for, <strong>ED will find it</strong>.
        </p>
        <p>
          Because smart shopping shouldn't take effort — it should just take E & D.
        </p>
      </div>
    </>
  );
};

export default About;
