const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const urlencodedParser = bodyParser.urlencoded({ extended: false })
const url = require('url');
const fs = require('fs');
const uuid = require('uuid');
const rmlparser = require('./rml-parser');
//var mongodbpythontransformer = require('./transformers/mongodb/python/mongodb-python-transformer');
const mongodbpythontransformer = require('./mongodb-python-transformer');

const archiver = require('archiver');
/**
 * @param {String} source
 * @param {String} out
 * @returns {Promise}
 */
function zipDirectory(source, out) {
    const archive = archiver('zip', { zlib: { level: 9 }});
    const lambdaStream = fs.createWriteStream(out);
  
    return new Promise((resolve, reject) => {
      archive
        .directory(source, false)
        .on('error', err => reject(err))
        .pipe(lambdaStream)
      ;
  
      lambdaStream.on('close', () => resolve());
      archive.finalize();
    });
  }

app.set('view engine', 'pug')
app.use(express.static('views'))

//app.get('/', (req, res) =>
//  res.send('Hello World!'))

app.get('/', function (req, res){
    res.render('transform', {message: 'Welcome to Mapping Translator!\nTranslate your OBDA mappings to GraphQL Resolvers'})
})



app.get('/testzip', function (req, res){
    zipDirectory("tmp/5d288b25-4793-468e-a791-30c99c569441", "tmp/5d288b25-4793-468e-a791-30c99c569441.zip")
    res.render('transform', {message: 'Welcome to Mapping Translator!\nTranslate your OBDA mappings to GraphQL Resolvers'})
})


app.get('/transform', function (req, res){
    res.render('transform', {message: 'Welcome to Mapping Translator!\nTranslate your OBDA mappings to GraphQL Resolvers'})
})

app.post('/transform', urlencodedParser, function (req, res) {
  if (!req.body) return res.sendStatus(400)
      if(req.body.prog_lang && req.body.dataset_type && req.body.mapping_url && req.body.db_name){
        var random_text = create_resolver(req.body.prog_lang, req.body.mapping_language, req.body.dataset_type, req.body.mapping_url, req.body.db_name)
         //res.json({"msg": "success!"})
         res.download('./tmp/'+random_text+".zip")
       }
      else{
        res.json({ "error": "parameters are not passed" });
        //res.send(JSON.stringify({"error":'expecting map_lang, prog_lang, and dataset_type' }))
      }
})

function create_resolver(prog_lang, map_lang, dataset_type, mapping_url, db_name){
    console.log("prog_lang = "+ prog_lang)
    console.log("map_lang = "+ map_lang)
    console.log("dataset_type = "+ dataset_type)
    console.log("mapping_url = "+ mapping_url)
    console.log("database name = "+db_name)
    if (!fs.existsSync("tmp")){
        fs.mkdirSync("tmp");
    }

    var random_text = uuid.v4();
    var project_dir = './tmp/'+random_text+"/";
    if (!fs.existsSync(project_dir)){
        fs.mkdirSync(project_dir);
    }
    
    var data;
    if(map_lang == 'rml') {
        data = rmlparser.get_jsonld_from_mapping(mapping_url)
    } else {
        console.log(map_lang + " is not supported yet!")
    }

    if(prog_lang == 'python' && dataset_type == 'mongodb') {
        var class_name = data["class_name"]
        var logical_source = data["logical_source"]
        var predicate_object = data["predicate_object"]

        var schema = mongodbpythontransformer.generateSchema(class_name, logical_source, predicate_object)
        //console.log("generated schema = \n" + schema )
        
        fs.writeFileSync(project_dir+"schema.py", schema, function (err){
            if(err){
               console.log('ERROR saving schema: '+err);
            }
            });

        var model = mongodbpythontransformer.generateModel(class_name, logical_source, predicate_object)
        //console.log("generated model = \n" + model )
        
        fs.writeFileSync(project_dir+"models.py", model, function (err){
                     if(err){
                        console.log('ERROR saving model: '+err);
                     }
                     });
        var pyapp_content = mongodbpythontransformer.generate_app(db_name);
        //console.log("pyapp_content: "+pyapp_content)
        fs.writeFileSync(project_dir+"app.py", pyapp_content);
        fs.writeFileSync(project_dir+"requirements.txt", mongodbpythontransformer.generate_requirements());
        fs.writeFileSync(project_dir+"startup.sh", mongodbpythontransformer.generate_statup_script());

        zipDirectory("tmp/" + random_text, "tmp/" + random_text + ".zip")





		/*
        const { execSync } = require('child_process');
        execSync('cd ./tmp;zip -r '+random_text+".zip "+random_text, function(err, stdout, stderr){
             if (err) {
            // node couldn't execute the command
             console.log('ERROR: '+err)
             return;
             }
             // the *entire* stdout and stderr (buffered)
             console.log(`stdout: ${stdout}`);
             console.log(`stderr: ${stderr}`);
             });
			 */
    } else {
        console.log(prog_lang + "/" +  dataset_type + " is not supported yet!")
    }
    return random_text;
    
}


app.listen(8082, () => console.log('Mapping Translator is listening on port 8082!'))
