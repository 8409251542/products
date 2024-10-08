const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    title: String,
    description: String,
    price: Number,
    dateOfSale: Date,
    isSold: Boolean,
    category: String
});

module.exports = mongoose.model('Product', ProductSchema);
