# MyScope Admin Panel

Professional admin dashboard for the MyScope entertainment platform. Built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.0.1-black)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 Features

### Authentication & Security
- ✅ **JWT-based authentication** with role-based access control
- ✅ **Protected routes** with automatic redirect for unauthorized users
- ✅ **5 admin roles**: Superadmin, Event Manager, Content Manager, Support, User
- ✅ **Session persistence** across page reloads
- ✅ **Auto-logout** on token expiration (401 errors)

### User Management
- ✅ **Full CRUD operations** for user accounts
- ✅ **Ban/unban functionality** with status tracking
- ✅ **Role assignment** and management
- ✅ **Search and filter** by name, email, and role
- ✅ **User statistics** dashboard

### Event Management
- ✅ **Create and manage events** with booking tracking
- ✅ **Event publishing** (draft/published states)
- ✅ **Capacity management** and booking counts
- ✅ **Date scheduling** with timezone support
- ✅ **Search and filter** by status and date

### Music Management
- ✅ **Upload and manage music tracks**
- ✅ **Artist profile management**
- ✅ **Genre categorization** with dynamic filtering
- ✅ **Play counts and likes** tracking
- ✅ **Metadata editing** (title, artist, album, duration)

### Community Moderation
- ✅ **Post moderation** with flagging system
- ✅ **View detailed post information**
- ✅ **Delete inappropriate content**
- ✅ **Status tracking** (active, flagged, removed)
- ✅ **Report monitoring**

### Shows Management
- ✅ **Video content management**
- ✅ **Category organization** (Entertainment, Comedy, Music, etc.)
- ✅ **Publish/unpublish** functionality
- ✅ **View counts** tracking
- ✅ **Scheduled publishing**

### Settings
- ✅ **Profile management** (name, email, password)
- ✅ **Site-wide settings** (name, description, contact)
- ✅ **Notification preferences**
- ✅ **Security settings** (2FA, API keys, sessions)
- ✅ **Maintenance mode** toggle

### UI/UX
- ✅ **Dark/light theme** with system preference detection
- ✅ **Responsive design** (mobile-first approach)
- ✅ **Toast notifications** for user feedback
- ✅ **Loading states** (5 different spinner components)
- ✅ **Error handling** with graceful error messages
- ✅ **Empty states** with actionable CTAs
- ✅ **Analytics dashboard** with Recharts visualizations

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn
- Backend API running (myscope-api)

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/MyScopeProject/myscope-admin.git
   cd myscope-admin
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   
   Create a \`.env.local\` file in the root directory:
   \`\`\`env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   \`\`\`

4. **Run the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Default Admin Credentials

\`\`\`
Email: admin@myscope.com
Password: admin123
Role: superadmin
\`\`\`

> **Note**: Change these credentials after first login in production!

## 📁 Project Structure

\`\`\`
myscope-admin/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── dashboard/           # Analytics dashboard
│   │   ├── users/               # User management
│   │   ├── events/              # Event management
│   │   ├── music/               # Music management
│   │   ├── community/           # Community moderation
│   │   ├── shows/               # Shows management
│   │   ├── settings/            # Admin settings
│   │   ├── login/               # Authentication
│   │   └── unauthorized/        # Access denied page
│   ├── components/
│   │   ├── auth/                # Authentication components
│   │   ├── layout/              # Layout components (AdminLayout)
│   │   ├── ui/                  # Reusable UI components
│   │   └── providers/           # Context providers
│   ├── contexts/
│   │   └── auth-context.tsx    # Authentication context
│   ├── lib/
│   │   ├── api.ts              # Axios instance
│   │   ├── apiEndpoints.ts     # API endpoint helpers
│   │   └── utils.ts            # Utility functions
│   └── app/
│       ├── globals.css         # Global styles
│       └── layout.tsx          # Root layout
├── public/                      # Static assets
├── .env.local                  # Environment variables (create this)
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies
\`\`\`

## 🎨 Tech Stack

### Core
- **Next.js 16.0.1** - React framework with App Router
- **React 19.2.0** - UI library
- **TypeScript 5.0** - Type safety
- **Tailwind CSS v4** - Utility-first CSS framework

### UI Components
- **Recharts 3.3.0** - Charts and analytics visualizations
- **Lucide React 0.553.0** - Icon library
- **react-hot-toast** - Toast notifications
- **class-variance-authority** - Component variants
- **clsx & tailwind-merge** - Class name utilities

### HTTP & State Management
- **Axios 1.7.7** - HTTP client with interceptors
- **React Context** - Global state management

## 🎯 API Integration

The admin panel connects to the backend API at \`NEXT_PUBLIC_API_URL\`. All requests automatically include the JWT token from localStorage.

## 🔐 Role-Based Access Control

| Page         | Superadmin | Event Manager | Content Manager | Support |
|--------------|------------|---------------|-----------------|---------|
| Dashboard    | ✅         | ✅            | ✅              | ✅      |
| Users        | ✅         | ❌            | ✅              | ❌      |
| Events       | ✅         | ✅            | ❌              | ❌      |
| Music        | ✅         | ❌            | ✅              | ❌      |
| Community    | ✅         | ❌            | ✅              | ✅      |
| Shows        | ✅         | ❌            | ✅              | ❌      |
| Settings     | ✅         | ❌            | ❌              | ❌      |

## 🎨 Theme System

The admin panel uses Tailwind CSS v4 with custom HSL color variables:

- **Primary**: Emerald (#10B981)
- **Secondary**: Indigo (#6366F1)
- **Accent**: Pink (#F472B6)
- **Default mode**: Dark theme
- **Toggle**: Light/dark mode switcher in header

## 📱 Responsive Design

All pages are fully responsive with mobile-first approach:

- **Mobile**: < 768px - Overlay sidebar, stacked layouts
- **Tablet**: 768px - 1024px - Adaptive grid layouts
- **Desktop**: > 1024px - Full sidebar, multi-column grids

## 🧪 Development Scripts

\`\`\`bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
\`\`\`

## 📚 Documentation

- [Setup Guide](./SETUP.md) - Detailed setup instructions
- [Theme Documentation](./THEME-SETUP.md) - Theme customization guide
- [Dashboard Guide](./DASHBOARD-COMPLETE.md) - Dashboard features
- [Route Protection](./ROUTE-PROTECTION.md) - Auth and route protection
- [UX Components](./LOADING-TOAST-ERRORS.md) - Loading states and error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## 📄 License

MIT License

## 👥 Team

- **Organization**: MyScopeProject
- **Repository**: myscope-admin
- **Related Projects**:
  - [myscope-api](https://github.com/MyScopeProject/myscope-api) - Backend API
  - [myscope-web](https://github.com/MyScopeProject/myscope-web) - User-facing website

## 🗺️ Roadmap

- [ ] Backend admin CRUD endpoints
- [ ] File upload functionality (images, videos, audio)
- [ ] Real-time notifications with WebSockets
- [ ] Advanced analytics and reporting
- [ ] Export data to CSV/PDF
- [ ] Email template management
- [ ] Multi-language support (i18n)
- [ ] Audit logging system
- [ ] Two-factor authentication (2FA)

---

**Built with ❤️ by the MyScope Team**
