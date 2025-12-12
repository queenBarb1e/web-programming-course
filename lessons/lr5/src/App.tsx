import Task4 from './tasks/Task4';

import { Auth } from './components/Auth';

function App() {
  return (
    <Auth>
      <div className="flex justify-center items-center h-screen">
        {<Task4 /> }
      </div>
    </Auth>
  )
}

export default App; 
