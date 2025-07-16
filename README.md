# DataWiz

ML-powered data quality analysis tool with machine learning capabilities for comprehensive data assessment and issue detection.

<img width="1771" height="874" alt="image" src="https://github.com/user-attachments/assets/78c1be3f-fefd-4fc4-a7b5-67b07497d8be" />


## About DataWiz

DataWiz is a comprehensive data quality analysis platform that leverages machine learning algorithms to automatically detect, analyze, and report data quality issues in CSV files. The tool combines traditional statistical analysis with advanced ML models to provide deep insights into your data's health and reliability.

### What DataWiz Does

- **Automated Data Profiling**: Generates detailed statistical summaries and data type analysis
- **ML-Powered Anomaly Detection**: Uses multiple machine learning algorithms to identify outliers and unusual patterns
- **Data Quality Assessment**: Evaluates completeness, consistency, validity, and accuracy of your datasets
- **Interactive Visualization**: Provides rich dashboards and charts to visualize data quality metrics
- **Issue Classification**: Categorizes detected problems by severity and type for prioritized remediation
- **Pattern Recognition**: Identifies hidden relationships and dependencies within your data

### Key Capabilities

- **Multi-Algorithm Analysis**: Employs ensemble methods using XGBoost, LightGBM, and TensorFlow for robust detection
- **Real-time Processing**: Processes large datasets efficiently with batch processing capabilities
- **User-friendly Interface**: Intuitive web interface requiring no technical expertise to operate

<img width="1715" height="943" alt="image" src="https://github.com/user-attachments/assets/f068be08-7e51-46f5-8434-3e92eb719c77" />
<img width="1718" height="950" alt="image" src="https://github.com/user-attachments/assets/8a57b8f7-61d2-4cdf-917a-a80a94400136" />



## Features

- 📊 **Data Quality Analysis** - Comprehensive analysis of CSV files with ML-powered insights
- 🤖 **Machine Learning Models** - Advanced anomaly detection using ensemble methods
- 🔍 **Issue Detection** - Automatic identification of data quality problems and inconsistencies
- 📈 **Visual Reports** - Interactive dashboards with detailed charts and metrics
- 🧹 **Data Profiling** - Statistical analysis with correlation matrices and distribution plots
- 🎯 **Anomaly Scoring** - Quantitative scoring of data quality issues with confidence levels
- 📋 **Detailed Logging** - Comprehensive analysis logs for debugging and audit trails

## Prerequisites

- Node.js 18+ 
- Python 3.8+
- MongoDB (local installation)
- Redis (local installation)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AmanVattoli/DataWiz.git
cd DataWiz
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
MONGODB_URI=mongodb://localhost:27017/data-wiz
REDIS_URL=redis://localhost:6379
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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload CSV File** - Upload your data file for analysis through the web interface
2. **Configure Analysis** - Select analysis parameters and ML models to use
3. **View Results** - Review comprehensive data quality reports with visualizations
4. **Identify Issues** - Examine detected problems categorized by type and severity

## ML Models Included

- **Great Expectations** - Auto-generates expectations and validates data quality rules
- **Deequ (Amazon)** - Constraint generation and ML anomaly detection
- **HoloClean** - Probabilistic error detection and repair
- **Cleanlab** - ML-based mislabel detection
- **Scikit-learn** - Classification, clustering, and statistical anomaly detection
- **XGBoost** - Gradient boosting for advanced pattern recognition and feature importance
- **LightGBM** - Fast gradient boosting framework optimized for large datasets
- **TensorFlow** - Deep learning models for complex anomaly detection patterns
- **PyOD** - Comprehensive outlier detection algorithms library
- **SHAP** - Model interpretability and feature importance analysis

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Next.js API Routes
- **Database**: MongoDB, Redis
- **ML/AI**: Python, scikit-learn, XGBoost, TensorFlow
- **Data Processing**: pandas, numpy, scipy
- **Visualization**: Chart.js, D3.js integration

## Project Structure

```
DataWiz/
├── app/                    # Next.js app directory
│   ├── api/               # API routes for data processing
│   └── pages/             # Application pages and UI
├── components/            # React components and UI elements
├── lib/                   # Utility libraries and helpers
├── scripts/               # Python ML scripts
│   └── data_quality_analyzer.py  # Main ML analysis engine
├── public/                # Static assets and images
├── temp/                  # Temporary file storage for uploads
└── requirements.txt       # Python ML dependencies
```

## How It Works

1. **Data Ingestion**: CSV files are uploaded and validated
2. **Preprocessing**: Data is cleaned and prepared for ML analysis
3. **ML Analysis**: Multiple algorithms analyze the data simultaneously
4. **Issue Detection**: Anomalies and quality issues are identified and scored
5. **Report Generation**: Comprehensive reports with visualizations are created
6. **Results Display**: Interactive dashboard presents findings with actionable insights 
