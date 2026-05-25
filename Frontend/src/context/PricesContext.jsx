import React, { createContext, useContext, useState, useEffect } from "react";
import api from '../api/api';
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const PriceContext = createContext();

export function PricesProvider({ children }) {
    const { isAuthenticated } = useAuth();
    const { showToast } = useToast();
    const [prices, setPrices] = useState([]);
    const [mtPrices, setMtPrices] = useState([]);
    const [loading, setLoading] = useState(false);

    const getAllPrices = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/rates`);
            setPrices(res.data);
            return res;
        } catch (err) {
            showToast(err.response?.data?.message || "Error fetching prices", "error");
        } finally {
            setLoading(false);
        }
    };

    const getPriceByDate = async (code, date) => {
        try {
            setLoading(true);
            const res = await api.get(`/rates/price`, {
                params: { code, date }
            });
            return res.data;
        } catch (err) {
            throw err.response?.data?.message || "Error fetching price";
        } finally {
            setLoading(false);
        }
    };

    const getPriceByID = async (id) => {
        try {
            setLoading(true);
            const res = await api.get(`/rates/${id}`);
            setPrices(res.data);
            return res;
        } catch (err) {
            showToast(err.response?.data?.message || "Error fetching price", "error");
        } finally {
            setLoading(false);
        }
    };

    const addPrice = async (payload) => {
        try {
            setLoading(true);
            const res = await api.post('/rates', payload);
            showToast(res.data.message || "Price added sucessfully", "success");
            await getAllPrices();
            return res;
        } catch (err) {
            showToast(err.response?.data?.message || "Error adding price", "error");
        } finally {
            setLoading(false);
        }
    };

    const updatePrice = async (id, payload) => {
        try {
            setLoading(true);
            const res = await api.patch(`/rates/${id}`, payload, { withCredentials: true });
            showToast(res.data.message || "Price updated sucessfully", "success");
            await getAllPrices();
            return res;
        } catch (err) {
            showToast(err.response?.data?.message || "Error updating price", "error");
        } finally {
            setLoading(false);
        }
    };

    const deletePrice = async (id) => {
        try {
            setLoading(true);
            const res = await api.delete(`/rates/${id}`);
            showToast(res.data.message || "Price deleted sucessfully", "success");
            setPrices(prices.filter((c) => c._id !== id));
            return res;
        } catch (err) {
            showToast(err.response?.data?.message || "Error deleting price", "error");
        } finally {
            setLoading(false);
        }
    };

    const addMtPrice = async (payload) => {
        try {
            setLoading(true);
            const res = await api.post('/mt', payload);
            showToast(res.data.message || "mt price added successfully", "success");
            await getAllMtPrices();
            return res.data.data;
        } catch (err) {
            showToast(err.response?.data?.message || "error adding mtPrice", "error");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const getAllMtPrices = async () => {
        try {
            setLoading(true);
            const res = await api.get('/mt');
            showToast(res.data?.message || "Mt prices fetched", "success");
            setMtPrices(res.data.data);
            return res.data.data;
        } catch (err) {
            showToast(err.response.data?.message || "error fetching all mt prices", "error");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const updateMtPrice = async (id, payload) => {
        try {
            setLoading(true);
            const res = await api.patch(`/mt/${id}`, payload);
            showToast(res.data?.message || "Mt prices updated", "success");
            setMtPrices(prev => prev.map(item => item._id === id ? res.data?.data : item));
            return res.data.data;
        } catch (err) {
            showToast(err.response.data?.message || "error updaing mt price", "error");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const deleteMtPrice = async (id) => {
        try {
            setLoading(true);
            const res = await api.delete(`/mt/${id}`);
            showToast(res.data?.message || "Mt prices deleted", "success");
            setMtPrices(prev => prev.filter(item => String(item._id) !== String(id)));
            return res.data;
        } catch (err) {
            showToast(err.response.data?.message || "error deleting mt price", "error");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        getAllPrices();
        getAllMtPrices();
    }, [isAuthenticated]);

    return (
        <PriceContext.Provider value={{ prices, mtPrices, loading, getAllPrices, updatePrice, getPriceByDate, getPriceByID, deletePrice, addPrice, addMtPrice, updateMtPrice, deleteMtPrice, getAllMtPrices }}>
            {children}
        </PriceContext.Provider>
    );

}

export const usePrice = () => useContext(PriceContext);