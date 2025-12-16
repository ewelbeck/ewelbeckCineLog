const axios = require("axios");
const express = require("express");
const mongoose = require("mongoose");
// const dotenv = require("dotenv");
// dotenv.config();

const app = express();
const PORT = process.argv[2] || process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.set("views", "./templates");

mongoose.connect(process.env.MONGO_CONNECTION_STRING)
    .then(() => console.log("Successful connection to MongoDB"))
    .catch(err => console.error(err));

const movieSchema = new mongoose.Schema({
    title: String,
    year: String,
    imdbID: String,
    poster: String,
    plot: String,
    rating: String,
    watched: { type: Boolean, default: false },

    userRating: { type: Number, min: 1, max: 5 },
    review: { type: String, maxlength: 250 },
    addedAt: { type: Date, default: Date.now }
});

const Movie = mongoose.model("Movie", movieSchema);
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/movies", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const sortOption = req.query.sort;
    let sortQuery = {};
    switch (sortOption) {
        case "title": sortQuery = { title: 1 }; break;
        case "date": sortQuery = { addedAt: -1 }; break;
        case "rating": sortQuery = { userRating: -1 }; break;
        case "watched": sortQuery = { watched: -1 }; break;
    }
    const totalMovies = await Movie.countDocuments();
    const movies = await Movie.find()
        .sort(sortQuery)
        .skip(skip)
        .limit(limit);
    res.render("viewLog", {
        movies,
        currentPage: page,
        totalMovies,
        start: skip + 1,
        end: Math.min(skip + limit, totalMovies),
        sort: sortOption
    });
});
app.get("/movies/add", (req, res) => {
    res.render("addMovie", { movie: null, error: null });
});
app.post("/movies/search", async (req, res) => {
    const { title } = req.body;
    try {
        const response = await axios.get(
            `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&t=${title}`
        );
        if (response.data.Response === "False") {
            return res.render("addMovie", { movie: null, error: "Movie not found" });
        }
        res.render("addMovie", { movie: response.data, error: null });
    } catch (err) {
        console.error(err);
        res.render("addMovie", { movie: null, error: "API error" });
    }
});
app.post("/movies/save", async (req, res) => {
    if (!req.body.imdbID) {
        return res.render("addMovie", {
            movie: null,
            error: "Invalid movie data. Please search again."
        });
    }
    const existingMovie = await Movie.findOne({ imdbID: req.body.imdbID });
    if (existingMovie) {
        return res.render("addMovie", {
            movie: null,
            error: "Movie is already on your watchlist!"
        });
    }
    await Movie.create({
        title: req.body.title,
        year: req.body.year,
        imdbID: req.body.imdbID,
        poster: req.body.poster,
        plot: req.body.plot
    });
    res.redirect("/movies");
});
app.post("/movies/toggle/:id", async (req, res) => {
    const movie = await Movie.findById(req.params.id);
    movie.watched = !movie.watched;
    await movie.save();
    res.redirect("/movies");
});
app.get("/movies/review/:id", async (req, res) => {
    const movie = await Movie.findById(req.params.id);
    res.render("modifyLog", { movie });
});
app.post("/movies/review/:id", async (req, res) => {
    const { userRating, review } = req.body;
    await Movie.findByIdAndUpdate(req.params.id, {
        watched: true,
        userRating,
        review
    });
    res.redirect("/movies");
});
app.post("/movies/delete/:id", async (req, res) => {
    await Movie.findByIdAndDelete(req.params.id);
    res.redirect("/movies");
});
app.post("/movies/clear", async (req, res) => {
    await Movie.deleteMany({});
    res.redirect("/movies");
});
// app.listen(PORT, () => {
//     console.log(`CineLog running on port ${PORT}`);
// });