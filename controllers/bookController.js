var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');

var async = require('async');

const { body,validationResult } = require('express-validator/check');
const { sanitizeBody } = require('express-validator/filter');
// ================================================================
// HOME PAGE (root)
// ================================================================
exports.index = function(req, res) {   
    
    async.parallel({
        book_count: function(callback) {
            Book.countDocuments({}, callback); // Pass an empty object as match condition to find all documents of this collection
        },
        book_instance_count: function(callback) {
            BookInstance.countDocuments({}, callback);
        },
        book_instance_available_count: function(callback) {
            BookInstance.countDocuments({status:'Available'}, callback);
        },
        author_count: function(callback) {
            Author.countDocuments({}, callback);
        },
        genre_count: function(callback) {
            Genre.countDocuments({}, callback);
        }
    }, function(err, results) {
        res.render('index', { title: 'Local Library Home', error: err, data: results });
    });
};
// ================================================================
// LIST BOOKS
// ================================================================
// Display list of all Books.
exports.book_list = function(req, res, next) {

    Book.find({}, 'title author')
      .populate('author') // takes data from the author model 
      .exec(function (err, list_books) {
        if (err) {
            return next(err); 
        }

        //Successful, so render
        res.render('book_list', { 
            title: 'Book List', book_list: list_books 
        });
      });
      
  };
// ================================================================
// BOOK DETAIL
// ================================================================
// Display detail page for a specific book.
exports.book_detail = function(req, res, next) {
    async.parallel({
        book: function(callback) {

            Book.findById(req.params.id)
              .populate('author')
              .populate('genre')
              .exec(callback);
        },
        book_instance: function(callback) {

          BookInstance.find({ 'book': req.params.id })
          .exec(callback);
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (results.book==null) { // No results.
            var err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        // Successful, so render.
        res.render('book_detail', { 
            title: results.book.title, 
            book: results.book, 
            book_instances: results.book_instance } );
    });

};
// ================================================================
// CREATE BOOK
// ================================================================
exports.book_create_get = function(req, res, next) {
    //res.send('NOT IMPLEMENTED: Book create GET');

    // Get all authors and genres, which we can use for adding to our book.
    async.parallel({
        authors: function(callback) {
            Author.find(callback);
        },
        genres: function(callback) {
            Genre.find(callback);
        },
    }, function(err, results){
        if (err) {return next(err); }
        res.render('book_form', { 
            title: 'Create Book', 
            authors: results.authors, 
            genres: results.genres });
    });
    
};

// Handle book create on POST.
exports.book_create_post = [
    // Convert the genre to an array.
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)){
            if(typeof req.body.genre==='undefined')
            req.body.genre=[];
            else
            req.body.genre = new Array(req.body.genre); 
            // Request all genres and convert the results into an array of genres 
        }
        next();
    },

    // Validate fields.
    body('title', 'Title must not be empty.').trim().isLength({ min: 1 }),
    body('author', 'Author must not be empty.').trim().isLength({ min: 1 }),
    body('summary', 'Summary must not be empty.').trim().isLength({ min: 1 }),
    body('isbn', 'ISBN must not be empty').trim().isLength({ min: 1 }),
  
    // Sanitize fields (using wildcard). - specifically the genre 
    sanitizeBody('*').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {
        
        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a Book object with escaped and trimmed data.
        var book = new Book(

          { title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: req.body.genre
           });
        
        // Error Form - Only Used if the user has entered in the wrong data
        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.

            // Get all authors and genres for form.
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                },
            }, function(err, results) {
                if (err) { return next(err); }

                // Mark our selected genres as checked.
                for (let i = 0; i < results.genres.length; i++) 
                {
                    if (book.genre.indexOf(results.genres[i]._id) > -1) {
                        results.genres[i].checked='true';
                    }
                }
                res.render('book_form', { 
                    title: 'Create Book',
                    authors:results.authors, 
                    genres:results.genres, 
                    book: book, 
                    errors: errors.array() 
                });
            });
            return;
        }
        else {
            // Data from form is valid. Save book.
            book.save(function (err) {
                if (err) { return next(err); }
                   //successful - redirect to new book record.
                   res.redirect(book.url);
                });
        }
    }
];





// ================================================================
// DELETE BOOK 
// ================================================================

// Display book delete form on GET.
exports.book_delete_get = function(req, res, next) {
    //res.send('NOT IMPLEMENTED: Book delete GET');

    // Get all authors and genres, which we can use for adding to our book.
    async.parallel({
        authors: function(callback) {
            Author.find(callback);
        },
        genres: function(callback) {
            Genre.find(callback);
        },
    }, function(err, results){
        // If no book exists with name
        if (err) {return next(err); }
        res.render('book_delete', { 
            title: 'Delete Book', 
            authors: results.authors, 
            genres: results.genres });
    });    


};

// Handle book delete on POST.
exports.book_delete_post = function(req, res, next) {
    //res.send('NOT IMPLEMENTED: Book delete POST');

    async.parallel({
        genre: function(callback) {
          Genre.findById(req.body.genreid).exec(callback)
        },
        genre_books: function(callback) {
          Genre.find({ 'genre': req.body.genreid }).exec(callback)
        },

    }, function(err, results) {
        if (err) { return next(err); }

        // Success
        if (results.authors_books.length > 0) {
            // Genre has books. Render in same way as for GET route.
            res.render('genre_delete', { 
                title: 'Delete Genre', 
                genre: results.genre, 
                genre_books: results.genre_books 
                });
            return;
        }
        else {
            // Genre has no books. Delete object and redirect to the list of geners.
            Genre.findByIdAndRemove(req.body.genreid, function deleteGenre(err){
                if (err) { return next(err); }
                // Success - go to author list
                res.redirect('/catalog/genre')
            })
        }
    });
};


















// ================================================================
// UPDATE BOOK 
// ================================================================
// Display book update form on GET.
exports.book_update_get = function(req, res, next) {
    // res.send('NOT IMPLEMENTED: Book update GET');

    //Get the book, authors and generes for the form (from the database)
    async.parallel(
            {
            book: function(callback) {
                Book.findById(req.params.id).populate('author').populate('genre').exec(callback);
            },
            authors: function(callback) {
                Author.find(callback);
            },
            genres: function(callback) {
                Genre.find(callback);
            },
        },
        function(err, results) {
            if (err) { return next(err); }
            if (results.book==null) 
            {
                var err = new Error("Book not found");
                err.status = 404;
                return next(err);
            }

            // Book is found
            // Mark our selected genres as checked.
            // loop through all genres - get number of genres
            for (var all_genres = 0; all_genres < results.genres.length; all_genres++) {
                // loop through all book genres - get number of book genres
                for (var book_genres = 0; book_genres < results.book.genre.length; book_genres++) {
                    // if the all genre and the book genre match:
                    if (results.genres[all_genres]._id.toString()==results.book.genre[book_genres]._id.toString()) {
                        results.genres[all_genres].checked='true'; // display the genere as checked (ticked box)
                    }
                }
            }
            res.render('book_form', {
                title: 'Update Book', 
                authors: results.authors, 
                genres: results.genres, 
                book: results.book
            })
        });
};


// Handle book update on POST.
exports.book_update_post = [

    // Convert the genre to an array
    (req, res, next) => {
        if(!(req.body.genre instanceof Array)){
            if(typeof req.body.genre==='undefined')
            req.body.genre=[];
            else
            req.body.genre=new Array(req.body.genre);
        }
        next();
    },
   
    // Validate fields.
    body('title', 'Title must not be empty.').trim().isLength({ min: 1 }),
    body('author', 'Author must not be empty.').trim().isLength({ min: 1 }),
    body('summary', 'Summary must not be empty.').trim().isLength({ min: 1 }),
    body('isbn', 'ISBN must not be empty').trim().isLength({ min: 1 }),

    // Sanitize fields.
    sanitizeBody('title').escape(),
    sanitizeBody('author').escape(),
    sanitizeBody('summary').escape(),
    sanitizeBody('isbn').escape(),
    sanitizeBody('genre.*').escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a Book object with escaped/trimmed data and old id.
        var book = new Book(
          { title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: (typeof req.body.genre==='undefined') ? [] : req.body.genre,
            _id:req.params.id //This is required, or a new ID will be assigned!
           });

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/error messages.

            // Get all authors and genres for form.
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                },
            }, function(err, results) {
                if (err) { return next(err); }

                // Mark our selected genres as checked.
                for (let i = 0; i < results.genres.length; i++) {
                    if (book.genre.indexOf(results.genres[i]._id) > -1) {
                        results.genres[i].checked='true';
                    }
                }
                res.render('book_form', { 
                    title: 'Update Book',
                    authors: results.authors,
                    genres: results.genres, 
                    book: book, 
                    errors: errors.array() 
                });
            });
            return;
        }
        else {
            // Data from form is valid. Update the record using mongoose functions
            Book.findByIdAndUpdate(req.params.id, book, {}, function (err,thebook) {
                if (err) { return next(err); }
                   // Successful - redirect to book detail page.
                   res.redirect(thebook.url);
                });
        }
    }
];





// ================================================================
// DELETE AN AUTHOR ---------------------------------------------------
// ================================================================
// Display Author delete form on GET.
exports.author_delete_get = function(req, res, next) {

    //parallel fucntion to find the author and his books in the database 
    async.parallel({
        author: function(callback) {
            Author.findById(req.params.id).exec(callback)
        },
        authors_books: function(callback) {
          Book.find({ 'author': req.params.id }).exec(callback)
        },
    }, function(err, results) {
        // If no author exists with the name 
        if (err) { return next(err); }
        if (results.author==null) { // No results.
            res.redirect('/catalog/authors');
        }
        // Successful, so render.
        res.render('author_delete', { 
            title: 'Delete Author', 
            author: results.author, 
            author_books: results.authors_books } );
    });

};

// Handle Author delete on POST.
exports.author_delete_post = function(req, res, next) {

    async.parallel({
        author: function(callback) {
          Author.findById(req.body.authorid).exec(callback)
        },
        authors_books: function(callback) {
          Book.find({ 'author': req.body.authorid }).exec(callback)
        },
        
    }, function(err, results) {
        if (err) { return next(err); }

        // Success
        if (results.authors_books.length > 0) {
            // Author has books. Render in same way as for GET route.
            res.render('author_delete', { 
                title: 'Delete Author', 
                author: results.author, 
                author_books: results.authors_books 
                });
            return;
        }
        else {
            // Author has no books. Delete object and redirect to the list of authors.
            Author.findByIdAndRemove(req.body.authorid, function deleteAuthor(err) {
                if (err) { return next(err); }
                // Success - go to author list
                res.redirect('/catalog/authors')
            })
        }
    });
};


//uploading a file GET
exports.file_upload_get = function(req, res){
    res.render('file_upload');
}

// uploading a file POST
exports.file_upload_post = function(req, res, next) {
    
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
      }
    
      // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
      let sampleFile = req.files.sampleFile;
    
      // Use the mv() method to place the file somewhere on your server
      sampleFile.mv(`./upload/${sampleFile.name}`, function(err) {
        if (err)
          return res.status(500).send(err);
    
        res.send('File uploaded!');
      });
    
};


