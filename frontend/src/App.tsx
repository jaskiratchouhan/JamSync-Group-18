import { BrowserRouter, Route, Routes } from "react-router-dom";
import Authentication from "./pages/auth/Authentication";
import HomePage from "./HomePage";
import "./App.css";
export default function App(){
    return(
        <BrowserRouter>
        <Routes> 
            <Route path = "/" element = {<Authentication />}></Route>
            <Route path = "/homepage" element = {<HomePage />}></Route>
        </Routes>
        
        </BrowserRouter>
        
    )
}