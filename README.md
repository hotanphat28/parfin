<div align="center">
  <img src="src/frontend/images/logo.svg" alt="ParFin Logo" width="120" height="120">
  <h1>ParFin</h1>
</div>

ParFin is a finance management web application designed for couples. It helps track expenses, manage budgets, and maintain financial transparency, all with a focus on simplicity and ease of use.

## Features

- **Couple-Centric Design**: Tailored for managing shared finances.
- **Multi-lingual Support**: Supports **English** (default) and **Vietnamese**, switchable via the UI.
- **Fixed Items Management**: Manage recurring monthly items (e.g., Salary, Rent) and auto-generate transactions.
- **Fund Allocation**: Organize finances into specific funds (Serving, Support, Investment, Together Budget).
- **Flexible Transactions**: Support for Expenses, Incomes, and **Allocations (Transfers)** between accounts.
- **Exchange Rate Management**: Set custom exchange rates (USD/VND) for accurate currency conversion.
- **Visual Analytics**: Interactive bar charts (via Chart.js) to visualize spending by category and payment method.
- **Responsive UI**: Includes a **Collapsible Sidebar** for better space management on smaller screens.
- **Theme Support**: Includes Light, Dark, and System Auto-detection modes.
- **Detailed Tracking**: Track transaction details including **Payment Method (Cash/Bank)**, category, fund usage, and description.
- **Monthly Filtering**: Easily view and filter transactions by month.
- **User Authentication**: Secure login and session management.
- **Import/Export**: Easily import and export transactions in JSON or CSV format.
- **Admin Management**: Admins can create and manage user accounts.

## Technology Stack

- **Backend**: Python (Native `http.server`, `sqlite3`)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Chart.js
- **Database**: SQLite

## Directory Structure

```
parfin/
├── data/                   # SQLite database storage (created on run)
├── src/
│   ├── backend/            # Python server logic and database handling
│   │   ├── db.py           # Database connection and initialization
│   │   └── server.py       # HTTP request handlers and API routes
│   ├── frontend/           # Web interface assets
│   │   ├── css/            # Stylesheets
│   │   ├── images/         # Icons and logo
│   │   ├── js/             # Application logic (app.js, translations.js)
│   │   └── index.html      # Main entry point
│   └── scripts/            # Utility scripts (e.g., mock data generator)
├── tests/                  # Verification and performance tests
├── run.py                  # Application entry point
├── README.md               # Product documentation
└── LICENSE                 # MIT License
```

## Getting Started

### Prerequisites

- Python 3.x installed.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/parfin.git
    cd parfin
    ```

2.  Create the data directory:
    ```bash
    mkdir -p data
    ```

3.  Run the application:
    ```bash
    python run.py
    ```

    *Note: If you have multiple Python versions, you might need to use `python3 run.py`.*

4.  Open your browser and navigate to:
    ```
    http://localhost:8000
    ```

## Usage

1.  **Login**: Use the default admin credentials (if initialized) or credentials provided by your administrator.
2.  **Dashboard**: View your recent transactions, allocation charts, and financial overview.
3.  **Add Transaction**: Use the interface to log new expenses, incomes, or allocations.
4.  **Fixed Items**: Define recurring monthly items (like Rent or Salary) and easily generate them for the current month.
5.  **Settings**: Navigate to Settings to switch language, theme, or update the **Exchange Rate**.

## Data Management

The application uses **SQLite** for data storage, located at `data/parfin.db`.

- **Initialization**: The database is automatically initialized with the necessary tables and a default admin user on the first run of the application.
- **Default Credentials**:
    - **Username**: `admin`
    - **Password**: `admin123`
- **Mock Data**: You can generate mock data for testing purposes using the included script.
    ```bash
    python src/scripts/generate_mock_data.py
    ```
    This script will populate the database with random transactions for the year 2025.

### Import/Export

The application supports importing and exporting data to facilitate backups and external analysis.

- **Export**:
  1. Click the "Export" button on the dashboard.
  2. Select the data range (Current Month or All).
  3. Choose the format (**JSON** or **CSV**).
  4. Click "Export" to download the file.

- **Import**:
  1. Click the "Import" button on the dashboard.
  2. Select a valid **JSON** or **CSV** file (compatible with the export format).
  3. Click "Import" to add the transactions to the database.


## Testing

The product includes scripts to verify API functionality and test performance.

### Functional Testing

1.  **Start the Server**: Ensure the application is running (`python run.py`).
2.  **Run the Test Script**:
    Open a new terminal window and run:
    ```bash
    python tests/verify_api.py
    ```

The `verify_api.py` script covers:
- **Login**: Verifies authentication with default credentials.
- **Create Transaction**: Creates a sample expense transaction.
- **Get Transactions**: Verifies retrieval of created transactions.

### Performance Testing

The product also includes a script to test load and concurrency.

1.  **Start the Server**: Ensure the application is running.
2.  **Run the Performance Test**:
    ```bash
    python tests/performance_test.py
    ```

The `performance_test.py` script measures:
- **Concurrency**: Simulates multiple threads performing login and transaction retrieval operations.
- **Load Latency**: Measures response times as the database size increases.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## Attribution

This product was created with **Antigravity** and **Google Gemini 3 Pro**.

## License

This product is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
