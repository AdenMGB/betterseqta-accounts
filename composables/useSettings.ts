export const useSettings = () => {
  const { user } = useAuth();

  const getUserId = () => {
      if (user.value && user.value.id) {
          return user.value.id;
      }
      return 'user123'; 
  }

  const syncSettings = async (mySettings: any) => {
    const userId = getUserId();
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId
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
      const userId = getUserId();
      const response = await fetch('/api/settings', {
          method: 'GET',
          headers: {
              'X-User-ID': userId
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

