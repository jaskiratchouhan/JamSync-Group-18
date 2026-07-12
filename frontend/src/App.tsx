import { BrowserRouter, Route, Routes } from "react-router-dom";
import Authentication from "./pages/auth/Authentication";
import HomePage from "./HomePage";
import {Toaster} from "react-hot-toast";
import "./App.css";
import GuestWelcome from "./pages/auth/GuestWelcome";

export default function App(){
    return(
        <BrowserRouter>
        <Toaster />
        <Routes> 
            <Route path = "/" element = {<Authentication />}></Route>
            <Route path = "/homepage" element = {<HomePage />}></Route>
            <Route path = "/guest-welcome" element={<GuestWelcome />}></Route>
        </Routes>
        
        </BrowserRouter>
        
    )
}