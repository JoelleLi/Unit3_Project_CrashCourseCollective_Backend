import "dotenv/config"
import express, { Router } from "express"
import cors from "cors"
import bodyParser from "body-parser"
import mongoose from "mongoose"
import serverless from "serverless-http"

const api = express()

const fetch = (...args) => 
  import('node-fetch')
  .then(({default: fetch}) => 
  fetch(...args))

const app = express()
// app.use(cors())
api.use(cors({ origin: '*' }))

api.use(bodyParser.json())

const port = process.env.PORT || 4000
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET 


api.listen(port, () => {
    console.log(`Listening on port: ${port}`)
})

mongoose.connect(process.env.DATABASE_URL)

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: false
    },
    gitUrl: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false
    },
    linkedIn: {
        type: String,
        required: false
    },
    aboutMe: {
        type: String,
        required: false
    },
    userAvatar: {
        type: String,
        required: true
    },
    lastLogin: {
        type: Date, 
        required: true
    },
    cohort: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cohort"
    }
})

const cohortSchema = new mongoose.Schema({
    cohortName: {
        type: String,
        required: true
    },
    alumni: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Users"
    } 
})

const projectSchema = new mongoose.Schema({
    projectName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    collaborators: {
        type: String,
        required: false
    },
    description: {
        type: String,
        required: true
    },
    deploymentLink: {
        type: String,
        required: false
    },
    deploymentImage: {
        type: String,
        required: false
    },
    userAvatarUrl: {
        type: String,
        required: true
    },
    repoLink: {
        type: String,
        required: true
    }
})

const User = mongoose.model("User", userSchema)
const Cohort = mongoose.model("Cohort", cohortSchema)
const Project = mongoose.model("Project", projectSchema)

const router = Router()

router.get("/", (req, res) => {
    res.json({message: "Server running"})
})

//! COHORTS -------------------

router.get("/cohorts", async (req, res) => {
    try {
        const allCohorts = await Cohort.find({}).populate("cohortName")
        res.json(allCohorts)
    } catch(e) {
        console.error(e)
    }
})

router.post("/cohorts/new", (req, res) => {
    const cohort = req.body
    const newCohort = new Cohort({ cohortName: cohort.cohortName })
    newCohort.save()
    .then(() => {
        res.sendStatus(200)
    })
    .catch((e) => console.error(e))
})


router.put("/cohorts/:id", async (req, res) => {
    try {
        const cohortId = req.params.id
        const updatedCohortData = req.body

        // Check if the cohort exists
        const existingCohort = await Cohort.findById(cohortId)

        if (existingCohort) {
            // Update cohort details
            await Cohort.findByIdAndUpdate(cohortId, updatedCohortData)
            res.sendStatus(200);
        } else {
            res.status(404).send("Cohort not found")
        }
    } catch (error) {
        console.error(error)
        res.sendStatus(500)
    }
})


//! USERS -----------------------



router.get("/users", async (req, res) => {
    try {
        const allUsers = await User.find()
        res.json(allUsers)
    } catch (error) {
        console.error(error)
        res.sendStatus(500)
    }
})

router.get("/users/:username", async (req, res) => {
    try {
        const username = req.params.username
        const user = await User.findOne({username})

        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }
        res.json(user)
    } catch (error) {
        console.error(error)
        res.sendStatus(500)
    }
})

router.post("/users/new", async (req, res) => {
    const now = new Date()

    if ( await User.countDocuments({"username": req.body.username}) === 0 ) {
        const newUser = new User({
            username: req.body.username,
            gitUrl: req.body.gitUrl,
            userAvatar: req.body.userAvatar,
            lastLogin: now
        })
        newUser.save()
        .then(() => {
            res.sendStatus(200)
            //console.log(`New user: ${req.body.username}, gitUrl: ${req.body.gitUrl} added to database`)
        })
        .catch(err => {
            res.sendStatus(500)
        })
    } else {
        try {
            await User.findOneAndUpdate(
                {"username": req.body.username},
                {"gitUrl": req.body.gitUrl}, 
                {"userAvatar": req.body.userAvar},
                {lastLogin: now}
                )
                res.sendStatus(200)
        } catch (error) {
            console.error(error)
            res.sendStatus(500)
        }
    }
})

router.put("/users/:username", async (req, res) => {
    
    try {
        const username = req.params.username
        const now = new Date()

        // Check if the cohort name is provided in the request body
        const existingCohort = await Cohort.findById(req.body.cohort)

        const currentUserDetails = await User.findOne({ username : username })

        if (existingCohort) {
            // Update user details and cohort alumni
            const updatedUser = await User.findOneAndUpdate({ username : username }, {
                fullName: req.body.fullName,
                gitUrl: req.body.gitUrl,
                email: req.body.email,
                linkedIn: req.body.linkedIn,
                aboutMe: req.body.aboutMe,
                cohort: existingCohort._id,
                lastLogin: now
            })
            // Remove the user from their previous cohort
            const updatedCohort = await Cohort.findOneAndUpdate(
                { _id: currentUserDetails.cohort }, 
                { $pull: { alumni: currentUserDetails._id } }
            )

            const updatedCohort2 = await Cohort.findByIdAndUpdate(existingCohort._id, {
                $addToSet: { alumni: currentUserDetails._id }
            })

        } else {
            // Update user details without updating the cohort
            await User.findOneAndUpdate({ username }, {
                fullName: req.body.fullName,
                gitUrl: req.body.gitUrl,
                email: req.body.email,
                linkedIn: req.body.linkedIn,
                aboutMe: req.body.aboutMe,
                lastLogin: now
            })
        }

        res.sendStatus(200)
    } catch (error) {
        console.error(error)
        res.sendStatus(500)
    }
})


router.delete("/users/:id", async (req, res) => {
    const userId = req.params.id
    try {
        // Find the user by ID
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        // Remove the user from their cohort
        const cohortId = user.cohort
        if (cohortId) {
            await Cohort.findByIdAndUpdate(cohortId, { $pull: { alumni: userId } })
        }

        // Delete the user account
        await User.findByIdAndDelete(userId)
        

        res.sendStatus(200)
    } catch (error) {
        console.error(error)
        res.sendStatus(500)
    }
})


//! PROJECTS ---------------------



router.get('/projects', async (req, res) => {
    try{
        const allProjects = await Project.find({})
        res.json(allProjects)
    }
    catch(err){
        console.error(err)
    }
})

router.get('/projects', async (req, res) => {
    try{
        const allProjects = await Project.find({})
        res.json(allProjects)
    }
    catch (err){
        console.error(err)
    }
})

router.get("/projects/:username", async (req, res) => {
    try {
        const username = req.params.username;
        const projects = await Project.find({ username });

        if (!projects || projects.length === 0) {
            return res.status(404).json({ message: "No projects found for the specified username" });
        } else{res.json(projects);}
        
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

router.get("/project/:id", async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({ message: "No project found for the specified ID" });
        }
        
        res.json(project);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});


router.post('/project/add', async (req, res) => { 
    const project = req.body
    const newProject = new Project({
        projectName: project.projectName,
        username: project.username,
        collaborators: project.collaborators,
        description: project.description,
        deploymentLink: project.deploymentLink,
        userAvatarUrl: project.userAvatarUrl,
        repoLink: project.repoLink
    })

    await newProject.save()
    .then(() => {
       // console.log(`${project.projectName} was added to the database`)
    res.sendStatus(200)
    })
    .catch(error => console.error(error))
})

router.put('/project/:id', async (req, res) => {
    try {
        const projectId = req.params.id
        const updatedProjectData = req.body
        const existingProject = await Project.findById(projectId)

        if (!existingProject) {
            return res.status(404).send('Project not found')
        }

        existingProject.projectName = updatedProjectData.projectName
        existingProject.description = updatedProjectData.description
        existingProject.collaborators = updatedProjectData.collaborators
        existingProject.deploymentLink = updatedProjectData.deploymentLink
        existingProject.deploymentImage = updatedProjectData.deploymentImage
        existingProject.repoLink = updatedProjectData.repoLink
        //save updated
        await existingProject.save()
        
        res.status(200).send('Project saved')
    } catch (error) {
        console.error(error)
        res.status(500).send('Backend Error')
    }
})

router.delete("/project/:id", async (req, res) => {
    try {
        const projectId = req.params.id;
        const deletedProject = await Project.findByIdAndDelete(projectId)

        if (!deletedProject) {
            return res.status(404).json({ message: "Project not found" })
        }

        res.sendStatus(200)
    } catch (error) {
        console.error(error)
        res.sendStatus(500)
    }
})

router.get("/projects/collab/:username", async (req, res) => {
    try {
        const username = req.params.username;
        
        // Find projects where either the username matches the owner or the username is found within the collaborators array
        const projects = await Project.find({
            $or: [
                { username }, // Owner username
                { collaborators: { $regex: new RegExp(username, 'i') } } // Case-insensitive regex search for the username within collaborators
            ]
        });

        if (!projects || projects.length === 0) {
            return res.status(404).json({ message: "No projects found for the specified username" });
        } else {
            res.json(projects);
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
}); 


//! GITHUB ---------------------


router.get('/getAccessToken', async function (req,res) {
    req.query.code

    const params = `?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${req.query.code}`
    try{
        await fetch('https://github.com/login/oauth/access_token' + params, {
            method: "POST",
            headers: {
                'Accept': 'application/json'
            }
        }).then((response) => {
            return response.json()
        }).then((data) => {
            res.json(data)
        })
    } catch (e) {
        console.error(e)
    }
})

//get USERDATA GITHUB
router.get ('/getUserData', async function (req, res) {
    req.get('Authorization')
    await fetch ('https://api.github.com/user', {
        method: 'GET',
        headers: {
            "Authorization" : req.get('Authorization') 
        }
    }).then((response) => {
        return response.json()
    }).then ((data) => {
        res.json(data)
    })
})

api.use('/api/', router)

export const handler = serverless(api)

