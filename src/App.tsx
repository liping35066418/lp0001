import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import PrivateRoute from '@/components/common/PrivateRoute';
import ToastContainer from '@/components/common/ToastContainer';
import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import Dashboard from '@/pages/Dashboard';
import ReservationList from '@/pages/ReservationList';
import ReservationForm from '@/pages/ReservationForm';
import SessionList from '@/pages/SessionList';
import BoardgameList from '@/pages/BoardgameList';
import BoardgameForm from '@/pages/BoardgameForm';
import RentalList from '@/pages/RentalList';
import RentalForm from '@/pages/RentalForm';
import GoodsList from '@/pages/GoodsList';
import GoodsManage from '@/pages/GoodsManage';
import Checkout from '@/pages/Checkout';
import BillHistory from '@/pages/BillHistory';
import RoomSettings from '@/pages/RoomSettings';
import PricingSettings from '@/pages/PricingSettings';
import GeneralSettings from '@/pages/GeneralSettings';
import ReportOverview from '@/pages/ReportOverview';
import ReportRevenue from '@/pages/ReportRevenue';
import ReportBoardgames from '@/pages/ReportBoardgames';
import UserManage from '@/pages/UserManage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="reservations" element={<ReservationList />} />
          <Route path="reservations/new" element={<ReservationForm />} />
          <Route path="sessions" element={<SessionList />} />
          <Route path="boardgames" element={<BoardgameList />} />
          <Route path="boardgames/new" element={<BoardgameForm />} />
          <Route path="rentals" element={<RentalList />} />
          <Route path="rentals/new" element={<RentalForm />} />
          <Route path="goods" element={<GoodsList />} />
          <Route path="goods/manage" element={<GoodsManage />} />
          <Route path="checkout/:sessionId" element={<Checkout />} />
          <Route path="history/bills" element={<BillHistory />} />
          <Route path="settings/rooms" element={<RoomSettings />} />
          <Route path="settings/pricing" element={<PricingSettings />} />
          <Route path="settings/general" element={<GeneralSettings />} />
          <Route path="reports/overview" element={<ReportOverview />} />
          <Route path="reports/revenue" element={<ReportRevenue />} />
          <Route path="reports/boardgames" element={<ReportBoardgames />} />
          <Route path="users" element={<UserManage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}
