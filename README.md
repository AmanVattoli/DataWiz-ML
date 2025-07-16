# DataWiz-ML

AI-powered data quality analysis tool with machine learning capabilities for comprehensive data assessment and issue detection.

## Features

- 📊 **Data Quality Analysis** - Comprehensive analysis of CSV files
- 🤖 **Machine Learning Models** - Advanced anomaly detection and pattern recognition
- 🔍 **Issue Detection** - Automatic identification of data quality problems
- 📈 **Visual Reports** - Interactive dashboards and data visualization
- 🧹 **Data Profiling** - Detailed statistical analysis and data profiling

## Prerequisites

- Node.js 18+ 
- Python 3.8+
- MongoDB (local installation)
- Redis (local installation)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AmanVattoli/DataWiz-ML.git
cd DataWiz-ML
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Setup Environment

Create a `.env.local` file in the root directory:

```env
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
MONGODB_URI=mongodb://localhost:27017/data-wiz
REDIS_URL=redis://localhost:6379

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. Start Services

Make sure MongoDB and Redis are running:

```bash
# Start MongoDB
mongod

# Start Redis
redis-server
```

### 5. Run the Application

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload CSV File** - Upload your data file for analysis
2. **View Analysis** - Review comprehensive data quality reports
3. **Identify Issues** - See detected problems and anomalies
4. **Export Results** - Download analysis reports

## ML Models Included

- **Scikit-learn** - Classification, clustering, and anomaly detection
- **XGBoost** - Gradient boosting for advanced pattern recognition
- **LightGBM** - Fast gradient boosting framework
- **TensorFlow** - Deep learning for complex anomaly detection
- **PyOD** - Outlier detection algorithms
- **Cleanlab** - Data cleaning with machine learning
- **SHAP** - Model interpretability and feature importance

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Next.js API Routes
- **Database**: MongoDB, Redis
- **ML/AI**: Python, scikit-learn, XGBoost, TensorFlow
- **Authentication**: NextAuth.js

## Project Structure

```
DataWiz-ML/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   └── pages/             # Application pages
├── components/            # React components
├── lib/                   # Utility libraries
├── scripts/               # Python ML scripts
│   └── data_quality_analyzer.py
├── public/                # Static assets
├── temp/                  # Temporary file storage
└── requirements.txt       # Python dependencies
```

## Contributing

Feel free to submit issues and enhancement requests!

## Author

**Aman Vattoli** - [GitHub](https://github.com/AmanVattoli) 