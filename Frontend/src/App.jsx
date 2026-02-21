import './App.css';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SignInPage from './pages/SignInPage';
import ProtectedRoute from './Components/ProtectedRoute';
import { PublicRoute } from './Components/PublicRoute';
import RegisterPage from './pages/RegisterPage';


function App() {

  return (
    <>
      <Routes>
        <Route path='/signin' index element={<PublicRoute> <SignInPage /></PublicRoute>} />
        <Route path='/register' element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={<Dashboard />} />
        </Route>

      </Routes>
    </>
  );
}


export default App
