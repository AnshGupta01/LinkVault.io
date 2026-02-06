import { BrowserRouter, Routes, Route } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import ViewPage from './pages/ViewPage';
import SuccessPage from './pages/SuccessPage';
import './index.css';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<UploadPage />} />
                <Route path="/share/:shareId" element={<ViewPage />} />
                <Route path="/success/:shareId" element={<SuccessPage />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
