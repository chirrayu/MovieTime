# MovieTime 🍿

MovieTime is a high-performance, fully responsive movie and TV show streaming web application. Built with modern web technologies, it features a rich Netflix-style user interface, global search capabilities, seamless playback of thousands of titles, and zero-backend client-side persistence.

![MovieTime Hero Banner](https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80)

## ✨ Features

- **Global Media Catalog**: Powered by the TMDB (The Movie Database) API, allowing users to browse, discover, and search for essentially any movie or TV series in existence.
- **Integrated Video Player**: Stream content instantly via seamlessly integrated third-party streaming providers (e.g. vaplayer.ru), complete with multi-language dubbing support directly from the player interface.
- **Client-Side Persistence**: Your Watchlist, User Preferences (like default audio/dubbing languages), and "Continue Watching" progress are securely saved locally to your device via `localStorage`—no account creation required.
- **TV Show Support**: Fully functional episode and season selectors. Automatically loads the next episode when the current one finishes.
- **Fully Responsive Layout**: Features a slick desktop sidebar that effortlessly converts into a mobile-friendly Bottom Navigation Bar on smaller devices.
- **Dark Mode Aesthetic**: A highly polished, cinematic UI using Tailwind CSS glassmorphism, fluid animations (Framer Motion), and glowing accents.

## 🛠 Tech Stack

- **Frontend Framework**: [React 18](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion (Framer Motion)](https://motion.dev/)
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Hosting / Deployment**: Designed for seamless deployment to [Vercel](https://vercel.com/) via `vercel.json` SPA configuration.

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository** (or download the source):
   ```bash
   git clone https://github.com/chirrayu/MovieTime.git
   cd MovieTime/fontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

### Environment Variables
By default, the application uses a public TMDB API key embedded within `src/app/lib/api.ts`. For production or high-volume usage, it is recommended to replace this with your own TMDB API Key from [The Movie Database](https://www.themoviedb.org/documentation/api) and store it in a `.env.local` file.

## 📱 Mobile Friendly
MovieTime is meticulously optimized for all devices. When viewed on a phone, the app shifts from a desktop sidebar navigation to an intuitive bottom navigation bar, scales down massive hero banners, and adjusts text legibility for touch-friendly interaction.

## 📝 License
This project is for educational and demonstrative purposes. All metadata and imagery are provided by TMDB. Streaming content is embedded via third-party iframe providers and is not hosted or distributed by this application.