# Six Continents Contest - Interactive Travel Game

A web-based contest application where users solve riddles from YouTube videos to unlock stages and win prizes including Turkish Airlines miles.

## 🎮 Features

- **16 Progressive Stages**: Unlock stages by solving video riddles
- **Two-Part Riddles**: Advanced stages (5-15) have dual riddle challenges
- **Real-time Leaderboard**: Track stage winners and progress
- **User Authentication**: Secure sign-up/sign-in with Supabase
- **Progress Tracking**: Cloud-synced user progress
- **Responsive Design**: Works on desktop and mobile devices
- **Prize System**: Cash prizes, vacation credits, and airline miles

## 🏆 Prizes

- **Stage Winners**: $50 USD + $100 Vacation Credit
- **Stage 15 Bonus**: 50,000 Turkish Airlines Miles
- **Grand Prize**: 100,000 Turkish Airlines Miles (Stage 16)

## 🚀 Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Backend**: Supabase (Authentication, Database, Edge Functions)
- **Hosting**: Vercel
- **Payments**: Stripe integration
- **Video**: YouTube embedded players

## 📱 Live Demo

Visit the live contest: [Your Domain Here]

## 🛠️ Development

### Prerequisites

- Modern web browser
- Supabase account
- Vercel account (for deployment)

### Local Development

1. Clone the repository:
```bash
git clone [your-repo-url]
cd six-continents-contest
```

2. Open `index.html` in your browser or use a local server:
```bash
# Using Python
python -m http.server 3000

# Using Node.js
npx serve .
```

3. The app will be available at `http://localhost:3000`

### Environment Setup

The app uses Supabase for backend services. The configuration is already set up in the code:

- **Supabase URL**: `https://vlcjilzgntxweomnyfgd.supabase.co`
- **Supabase Anon Key**: Configured in the application

## 📦 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically deploy your app
4. Your app will be live at `https://your-app.vercel.app`

### Custom Domain

1. In Vercel dashboard, go to your project settings
2. Add your custom domain
3. Configure DNS records as instructed by Vercel

## 🎯 How to Play

1. **Sign Up**: Create an account to track your progress
2. **Watch Videos**: Each stage has a YouTube video with clues
3. **Solve Riddles**: Enter answers to unlock the next stage
4. **Progress Through Stages**: Complete all 16 stages to win
5. **Win Prizes**: First solvers and random draws win prizes

## 🔧 Configuration

### Supabase Setup

The app requires these Supabase tables:
- `solves`: User progress tracking
- `stage_winners`: Leaderboard data

### Edge Functions

- `validate-answer`: Server-side answer validation

## 📄 License

This project is proprietary. All rights reserved.

## 🤝 Support

For technical support or questions about the contest, please contact [your-email@domain.com]

---

**Good luck and enjoy your journey across six continents!** ✈️🌍