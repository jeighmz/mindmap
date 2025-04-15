import React from "react";
import { useApp } from "../contexts/AppContext";
import WhiteboardPage from '../pages/WhiteboardPage';
import LandingPage from '../pages/LandingPage';

const Layout = () => {
  const { currentPage } = useApp();

  return (
    <div className="App">
      <div className="App-body">
        {currentPage === "Main" && <LandingPage />}
        {currentPage === "Whiteboard" && <WhiteboardPage />}
      </div>
    </div>
  );
};

export default Layout; 