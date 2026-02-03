export const useSettings = () => {
  const getAuthToken = () => {
    if (process.client) {
      return localStorage.getItem('token');
    }
    return null;
  }

  const syncSettings = async (mySettings: any) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(mySettings)
    });
    
    if (!response.ok) {
        throw new Error('Failed to save settings');
    }

    const savedData = await response.json();
    console.log("Settings saved:", savedData);
    return savedData;
  };

  const getSettings = async () => {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/settings', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      return await response.json();
  }

  return {
    syncSettings,
    getSettings
  };
};

