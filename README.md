<div align="center">
  <img src="src/frontend/images/logo.svg" alt="ParFin Logo" width="120" height="120">
  <h1>ParFin</h1>
</div>

ParFin is a finance management web application designed for couples. It helps track expenses, manage budgets, and maintain financial transparency, all with a focus on simplicity and ease of use.

## Features

- **Couple-Centric Design**: Tailored for managing shared finances.
- **Vietnamese Localization (Việt hóa)**: Full UI localization and VND currency formatting (e.g., 100.000 ₫).
- **Visual Analytics**: Interactive bar charts (via Chart.js) to visualize spending by category and source (Cash vs Bank).
- **Theme Support**: Includes Light, Dark, and System Auto-detection modes.
- **Transaction Details**: Track detailed transaction info including source (Cash/Bank), category, and description.
- **Monthly Filtering**: Easily view and filter transactions by month.
- **User Authentication**: Secure login and session management.
- **Admin Management**: Admins can create and manage user accounts.

## Technology Stack

- **Backend**: Python (Native `http.server`, `sqlite3`)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Chart.js
- **Database**: SQLite

## Getting Started

### Prerequisites

- Python 3.x installed.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/parfin.git
    cd parfin
    ```

2.  Run the application:
    ```bash
    python run.py
    ```

    *Note: If you have multiple Python versions, you might need to use `python3 run.py`.*

3.  Open your browser and navigate to:
    ```
    http://localhost:8000
    ```

## Usage

1.  **Login**: Use the default admin credentials (if initialized) or credentials provided by your administrator.
2.  **Dashboard**: View your recent transactions, allocation charts, and financial overview.
3.  **Add Transaction**: Use the interface to log new expenses or income.

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

## Testing

The project includes scripts to verify API functionality and test performance.

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

The project also includes a script to test load and concurrency.

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
