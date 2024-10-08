const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Product = require('./model/product');

const app = express();
const PORT = 3000;

mongoose.connect('mongodb+srv://sqfclothingstore:OajB2fe2a5nKcMY0@cluster0.plwbq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('Connected!'))
    .catch((err)=>console.log("Some Errore while connecting the data base!!!/n",err));

app.get('/initialize', async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        const products = response.data;

        await Product.deleteMany({});

        const productDocs = products.map(item => ({
            title: item.title,
            description: item.description,
            price: item.price,
            dateOfSale: new Date(item.dateOfSale),
            isSold: item.isSold,
            category: item.category
        }));

        await Product.insertMany(productDocs);
        res.status(200).json({ message: 'Database initialized with seed data.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to initialize the database', details: error.message });
    }
});
// transactions
app.get('/transactions/:page?/:perPage?/:search?', async (req, res) => {
    const { page = 1, perPage = 10, search = '' } = req.params;
    const query = {};

    if (search) {
        query.$or = [
            { title: new RegExp(search, 'i') },
            { description: new RegExp(search, 'i') },
        ];
    }

    try {
        const transactions = await Product.find(query)
            .skip((page - 1) * perPage)
            .limit(parseInt(perPage));

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
    }
});

//bar-charts

app.get('/bar-chart/:month', async (req, res) => {
    const { month } = req.params;

    try {
        const monthNumber = new Date(`${month} 1, 2020`).getMonth() + 1;

        const priceRanges = [
            { min: 0, max: 100 },
            { min: 101, max: 200 },
            { min: 201, max: 300 },
            { min: 301, max: 400 },
            { min: 401, max: 500 },
            { min: 501, max: 600 },
            { min: 601, max: 700 },
            { min: 701, max: 800 },
            { min: 801, max: 900 },
            { min: 901, max: Infinity }
        ];

        const pipeline = [
            {
                $addFields: {
                    monthOfSale: { $month: "$dateOfSale" }
                }
            },
            {
                $match: { monthOfSale: monthNumber }
            },
            {
                $bucket: {
                    groupBy: "$price",
                    boundaries: [0, 101, 201, 301, 401, 501, 601, 701, 801, 901, Infinity],
                    default: "901+",
                    output: {
                        count: { $sum: 1 }
                    }
                }
            }
        ];

        const barChartData = await Product.aggregate(pipeline);

        const results = priceRanges.map((range, index) => ({
            priceRange: index === priceRanges.length - 1 
                ? `${range.min}+` 
                : `${range.min} - ${range.max}`,
            count: barChartData.find(bucket => bucket._id === range.min) ? barChartData.find(bucket => bucket._id === range.min).count : 0
        }));

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate bar chart data', details: error.message });
    }
});

//pie chart
app.get('/pie-chart/:month', async (req, res) => {
    const { month } = req.params;

    try {
        const monthNumber = new Date(`${month} 1, 2020`).getMonth() + 1;

        const pipeline = [
            {
                $addFields: {
                    monthOfSale: { $month: "$dateOfSale" }
                }
            },
            {
                $match: { monthOfSale: monthNumber }
            },
            {
                $group: {
                    _id: "$category",
                    itemCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    category: "$_id",
                    itemCount: 1,
                    _id: 0
                }
            }
        ];

        const categoryData = await Product.aggregate(pipeline);

        res.json(categoryData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate pie chart data', details: error.message });
    }
});

//statics
app.get('/statistics/:month', async (req, res) => {
    const { month } = req.params;
    const monthNumber = new Date(`${month} 1, 2020`).getMonth();

    try {
        const products = await Product.find({
            dateOfSale: { $gte: new Date(2020, monthNumber, 1), $lt: new Date(2020, monthNumber + 1, 1) }
        });

        const totalSaleAmount = products.reduce((sum, product) => sum + product.price, 0);
        const totalSoldItems = products.filter(product => product.isSold).length;
        const totalNotSoldItems = products.length - totalSoldItems;

        res.json({ totalSaleAmount, totalSoldItems, totalNotSoldItems });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch statistics', details: error.message });
    }
});
// Combined Data API with Month Parameter
app.get('/combined-data/:month', async (req, res) => {
    const { month } = req.params; 

    try {
        const [statistics, barChart, pieChart] = await Promise.all([
            axios.get(`http://localhost:${PORT}/statistics/${month}`).then(response => response.data),
            axios.get(`http://localhost:${PORT}/bar-chart/${month}`).then(response => response.data),
            axios.get(`http://localhost:${PORT}/pie-chart/${month}`).then(response => response.data)
        ]);

        res.json({ statistics, barChart, pieChart });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch combined data', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//OajB2fe2a5nKcMY0