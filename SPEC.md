# Role Camera Action! - Video Sharing Platform Specification

## 1. Project Overview
- **Project Name**: Role Camera Action!
- **Type**: Video Sharing Web Application (Single Page Application)
- **Core Functionality**: A YouTube-like platform for short to medium-length videos featuring actors and creators, with search and viewing capabilities
- **Target Users**: Actors, filmmakers, content creators, and viewers interested in acting/film content

## 2. UI/UX Specification

### Layout Structure
- **Header**: Fixed top navigation with logo, search bar, and navigation links
- **Sidebar**: Left-side collapsible navigation with genre categories
- **Main Content**: Video grid display with filtering options
- **Video Player Page**: Full-width video player with related videos sidebar
- **Footer**: Minimal footer with copyright and links

### Responsive Breakpoints
- Mobile: < 768px (single column, hamburger menu)
- Tablet: 768px - 1024px (2 column grid)
- Desktop: > 1024px (4 column grid with sidebar)

### Visual Design

#### Color Palette
- **Primary**: `#E50914` (Cinema Red - inspired by film industry)
- **Secondary**: `#141414` (Deep Black - cinema background)
- **Accent**: `#FFD700` (Gold - awards/glory)
- **Background**: `#0A0A0A` (Near Black)
- **Surface**: `#1A1A1A` (Card backgrounds)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#A0A0A0`
- **Border**: `#2A2A2A`

#### Typography
- **Logo Font**: 'Bebas Neue', sans-serif (bold, cinematic)
- **Headings**: 'Montserrat', sans-serif
- **Body**: 'Open Sans', sans-serif
- **Font Sizes**:
  - Logo: 32px
  - H1: 28px
  - H2: 22px
  - H3: 18px
  - Body: 14px
  - Small: 12px

#### Spacing System
- Base unit: 8px
- Margins: 8px, 16px, 24px, 32px
- Padding: 8px, 12px, 16px, 24px
- Card gap: 16px
- Section gap: 32px

#### Visual Effects
- Card hover: Scale 1.02, box-shadow elevation
- Buttons: Gradient backgrounds with glow effect
- Video thumbnails: Gradient overlay on hover
- Page transitions: Fade-in animations (0.3s)
- Loading skeletons: Shimmer animation

### Components

#### Header
- Logo (left): "ROLE CAMERA ACTION!" in Bebas Neue
- Search bar (center): Rounded input with search icon
- Navigation (right): Upload button, Categories dropdown, User avatar

#### Sidebar
- Genre categories with icons:
  - All Videos (grid icon)
  - Drama (theater mask)
  - Comedy (laugh icon)
  - Action (explosion icon)
  - Romance (heart icon)
  - Horror (skull icon)
  - Documentary (camera icon)
  - Auditions (microphone icon)
- Collapse toggle button

#### Video Card
- Thumbnail (16:9 aspect ratio)
- Duration badge (bottom-right of thumbnail)
- Title (max 2 lines, ellipsis)
- Channel name
- View count and upload date
- Genre tag

#### Video Player Page
- Large video player (16:9)
- Video title and description
- Like/Dislike buttons with counts
- Share button
- Channel info with subscribe button
- Comments section
- Related videos sidebar

#### Upload Modal
- Drag & drop zone
- Video preview
- Title, description inputs
- Genre selection dropdown
- Upload progress bar

## 3. Functionality Specification

### Core Features
1. **Video Browsing**: Grid display of videos with infinite scroll simulation
2. **Search**: Real-time search filtering by title and genre
3. **Category Filtering**: Filter videos by genre using sidebar
4. **Video Playback**: Modal-based video player with controls
5. **Video Upload**: Form to add new videos (simulated with localStorage)
6. **Like/Subscribe**: Interactive buttons with state persistence
7. **Responsive Design**: Works on all device sizes

### User Interactions
- Click video card → Open video player modal
- Type in search → Filter videos in real-time
- Click genre → Filter by category
- Click upload → Open upload modal
- Click like → Toggle like state
- Click subscribe → Toggle subscribe state

### Data Handling
- Mock video data stored in JavaScript
- LocalStorage for:
  - Uploaded videos
  - Liked videos
  - Subscribed channels

### Edge Cases
- Empty search results → Show "No videos found" message
- Video load error → Show placeholder with retry button
- Long titles → Truncate with ellipsis

## 4. Acceptance Criteria

### Visual Checkpoints
- [ ] Dark cinema-themed UI with red accents loads correctly
- [ ] Logo displays in Bebas Neue font
- [ ] Video grid shows 4 columns on desktop
- [ ] Cards have hover elevation effect
- [ ] Search bar is centered in header
- [ ] Sidebar genres are clickable and highlight

### Functional Checkpoints
- [ ] Search filters videos by title
- [ ] Genre filter works correctly
- [ ] Video player modal opens on card click
- [ ] Video plays in modal
- [ ] Upload modal opens and form is functional
- [ ] Like button toggles state
- [ ] Page is responsive on mobile

### Performance
- [ ] Initial page load < 3 seconds
- [ ] Smooth animations (60fps)
- [ ] No console errors

## 5. Technical Implementation

### File Structure
```
index.html      - Main HTML structure
styles.css      - All styling
app.js          - Application logic and data
```

### External Resources
- Google Fonts: Bebas Neue, Montserrat, Open Sans
- Font Awesome 6.4.0 for icons
- Placeholder video thumbnails from picsum.photos

